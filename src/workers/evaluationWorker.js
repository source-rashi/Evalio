/**
 * Evaluation Background Worker
 * 
 * This worker process runs independently from the API server.
 * It picks up evaluation jobs from the queue and processes them in the background.
 * 
 * Purpose:
 * - Decouple heavy processing from HTTP request/response cycle
 * - Enable horizontal scaling (run multiple workers)
 * - Automatic retry on failure
 * - Graceful error handling
 * 
 * Lifecycle:
 * 1. Worker connects to Redis queue
 * 2. Listens for new evaluation jobs
 * 3. Processes each job (fetch data, evaluate, save results)
 * 4. Updates job status on completion/failure
 * 5. Repeats until shutdown signal received
 * 
 * Usage:
 *   node src/workers/evaluationWorker.js
 * 
 * In production, use a process manager:
 *   pm2 start src/workers/evaluationWorker.js --instances 4
 */

const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');
const logger = require('../utils/logger');

// ML Integration Services (Phase 5C)
const { buildMLInput, validateMLInput, getMLInputStats } = require('../services/mlInputBuilder');
const { executePythonML } = require('../services/pythonMLExecutor');
const { mapMLResultToEvaluation, calculateEvaluationStats } = require('../services/mlOutputMapper');

// Redis configuration (must match queue configuration)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Connect to MongoDB
 * Worker needs database access to fetch/save evaluation data
 */
async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;
  
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is required');
  }
  
  await mongoose.connect(mongoUri);
  logger.info('Worker connected to MongoDB');
}

/**
 * Process a single evaluation job
 * 
 * This function contains the core evaluation logic using the ML pipeline.
 * 
 * Job data structure:
 * {
 *   submissionId: String,   // MongoDB ObjectId as string
 *   examId: String,
 *   studentId: String,
 *   triggeredBy: String,
 *   correlationId: String   // Request tracing ID
 * }
 * 
 * ML Pipeline Steps:
 * 1. Fetch submission, exam, and questions from database
 * 2. Build ML input using mlInputBuilder
 * 3. Execute Python ML engine using pythonMLExecutor
 * 4. Map ML output to Evaluation using mlOutputMapper
 * 5. Save evaluation to database
 * 6. Update submission status
 * 
 * @param {Object} job - BullMQ job object
 * @returns {Object} Evaluation result summary
 */
async function processEvaluation(job) {
  const { submissionId, examId, studentId, correlationId } = job.data;
  
  // Create child logger with correlationId for request tracing
  const jobLogger = correlationId 
    ? logger.createChild({ correlationId, jobId: job.id })
    : logger.createChild({ jobId: job.id });
  
  jobLogger.info({ submissionId, examId, studentId, attempt: job.attemptsMade + 1 }, 'Processing evaluation');
  
  // IDEMPOTENCY CHECK: Verify evaluation hasn't already been completed
  // This prevents duplicate processing on retry
  const existingEvaluation = await Evaluation.findOne({ submission_id: submissionId });
  
  if (existingEvaluation && existingEvaluation.jobStatus === 'completed') {
    jobLogger.info({ evaluationId: existingEvaluation._id }, 'Evaluation already completed - skipping (idempotent)');
    
    // Return existing result to prevent re-processing
    return {
      evaluationId: existingEvaluation._id,
      submissionId,
      totalScore: existingEvaluation.aiTotalScore,
      maxScore: existingEvaluation.results?.reduce((sum, r) => sum + (r.maxScore || 5), 0) || 0,
      questionCount: existingEvaluation.results?.length || 0,
      averageConfidence: existingEvaluation.averageConfidence,
      jobStatus: 'completed',
      skipped: true // Indicate this was a no-op
    };
  }
  
  // Update evaluation status to "processing" with attempt tracking
  await Evaluation.findOneAndUpdate(
    { submission_id: submissionId },
    {
      jobStatus: 'processing',
      processingStartedAt: new Date(),
      attemptNumber: job.attemptsMade + 1 // Track retry attempts
    }
  );
  
  await job.updateProgress(10);
  
  // Step 1: Fetch submission with answers
  const submission = await Submission.findById(submissionId);
  
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }
  
  jobLogger.debug({ answerCount: submission.answers.length }, 'Found answers to evaluate');
  await job.updateProgress(15);
  
  // Step 2: Fetch exam details
  const exam = await Exam.findById(examId);
  
  if (!exam) {
    throw new Error(`Exam not found: ${examId}`);
  }
  
  jobLogger.debug({ examTitle: exam.title }, 'Exam details fetched');
  await job.updateProgress(20);
  
  // Step 3: Fetch all questions for this exam
  const questionIds = submission.answers.map(a => a.question_id).filter(Boolean);
  const questions = await Question.find({ _id: { $in: questionIds } });
  
  if (questions.length === 0) {
    throw new Error(`No questions found for exam: ${examId}`);
  }
  
  jobLogger.debug({ questionCount: questions.length }, 'Questions fetched');
  await job.updateProgress(30);
  
  // Step 4: Build ML input
  const mlInput = buildMLInput({
    submission: submission.toObject(),
    exam: exam.toObject(),
    questions: questions.map(q => q.toObject()),
    answers: submission.answers
  });
  
  // Validate ML input structure
  const inputValidation = validateMLInput(mlInput);
  if (!inputValidation.valid) {
    throw new Error(`Invalid ML input: ${inputValidation.errors.join(', ')}`);
  }
  
  const inputStats = getMLInputStats(mlInput);
  jobLogger.debug({ inputStats }, 'ML input prepared');
  await job.updateProgress(40);
  
  // Step 5: Execute Python ML engine
  jobLogger.info('Executing Python ML engine');
  const mlResult = await executePythonML(mlInput, {
    timeout: 60000 // 60 second timeout for ML execution
  });
  
  jobLogger.info('ML execution complete');
  await job.updateProgress(70);
  
  // Step 6: Map ML output to Evaluation model
  const evaluationData = mapMLResultToEvaluation(mlResult, {
    submissionId: submissionId,
    examId: examId,
    expectedQuestionCount: questions.length,
    expectedQuestionIds: questions.map(q => String(q._id))
  });
  
  const evalStats = calculateEvaluationStats(evaluationData);
  jobLogger.debug({ evalStats }, 'Evaluation statistics calculated');
  await job.updateProgress(80);
  
  // Step 7: Save evaluation to database
  const evaluation = await Evaluation.findOneAndUpdate(
    { submission_id: submissionId },
    evaluationData,
    { upsert: true, new: true }
  );
  
  jobLogger.info({ evaluationId: evaluation._id }, 'Evaluation saved to database');
  await job.updateProgress(90);
  
  // Step 8: Update submission status and mark job as completed
  submission.status = SUBMISSION_STATUS.EVALUATED;
  await submission.save();
  
  // Update evaluation job status to completed
  await Evaluation.findByIdAndUpdate(evaluation._id, {
    jobStatus: 'completed',
    evaluatedAt: new Date()
  });
  
  await job.updateProgress(100);
  
  jobLogger.info({
    submissionId,
    totalScore: evaluationData.aiTotalScore,
    maxScore: evalStats.maxPossibleScore
  }, 'Evaluation completed successfully');
  
  return {
    evaluationId: evaluation._id,
    submissionId,
    totalScore: evaluationData.aiTotalScore,
    maxScore: evalStats.maxPossibleScore,
    questionCount: evalStats.questionCount,
    averageConfidence: evaluationData.averageConfidence,
    jobStatus: 'completed'
  };
}

/**
 * Create and start the evaluation worker
 */
async function startWorker() {
  logger.info('Starting Evaluation Worker');
  logger.info({ redis: `${redisConfig.host}:${redisConfig.port}` }, 'Redis configuration');
  
  // Connect to database first
  await connectDatabase();
  
  // Create worker instance
  const worker = new Worker('evaluation', async (job) => {
    // Create child logger with correlationId if available
    const jobLogger = job.data.correlationId
      ? logger.createChild({ correlationId: job.data.correlationId, jobId: job.id })
      : logger.createChild({ jobId: job.id });
    
    jobLogger.logJob(job, 'Job started');
    
    try {
      const result = await processEvaluation(job);
      jobLogger.logJob(job, 'Job completed', { result });
      return result;
      
    } catch (error) {
      jobLogger.logError(error, 'Job failed', { data: job.data });
      
      // RETRY-SAFE ERROR HANDLING
      // Update evaluation to mark job as failed, but preserve data for retry
      const { submissionId } = job.data;
      const attemptNumber = job.attemptsMade + 1;
      const maxAttempts = 3;
      const isLastAttempt = attemptNumber >= maxAttempts;
      
      await Evaluation.findOneAndUpdate(
        { submission_id: submissionId },
        {
          jobStatus: isLastAttempt ? 'permanently_failed' : 'failed',
          jobError: error.message,
          lastFailedAt: new Date(),
          attemptNumber: attemptNumber,
          // Only set as permanently failed if all retries exhausted
          ...(isLastAttempt && {
            status: EVALUATION_STATUS.FAILED
          })
        }
      );
      
      // Log whether this will be retried
      if (!isLastAttempt) {
        jobLogger.warn({
          submissionId,
          attemptNumber,
          maxAttempts,
          willRetry: true
        }, 'Job will be retried');
      }
      
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }, {
    connection: redisConfig,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10,      // Max 10 jobs
      duration: 1000 // Per second
    }
  });
  
  // Worker event handlers for monitoring
  // These provide visibility into job processing and failures
  
  worker.on('completed', (job, result) => {
    const jobLogger = job.data.correlationId
      ? logger.createChild({ correlationId: job.data.correlationId, jobId: job.id })
      : logger.createChild({ jobId: job.id });
    
    jobLogger.info({
      jobId: job.id,
      submissionId: job.data.submissionId,
      duration: job.finishedOn - job.processedOn,
      attempts: job.attemptsMade,
      result: {
        evaluationId: result.evaluationId,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        questionCount: result.questionCount
      }
    }, 'Job completed successfully');
  });
  
  worker.on('failed', (job, error) => {
    const jobLogger = job.data.correlationId
      ? logger.createChild({ correlationId: job.data.correlationId, jobId: job.id })
      : logger.createChild({ jobId: job.id });
    
    // Log detailed failure information
    jobLogger.error({
      jobId: job.id,
      submissionId: job.data.submissionId,
      examId: job.data.examId,
      studentId: job.data.studentId,
      attemptsMade: job.attemptsMade,
      maxAttempts: 3,
      willRetry: job.attemptsMade < 3,
      failedAt: new Date(job.failedReason?.failedAt || Date.now()),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      jobData: job.data
    }, 'Job failed');
    
    // If this was the final attempt, log as critical
    if (job.attemptsMade >= 3) {
      jobLogger.error({
        jobId: job.id,
        submissionId: job.data.submissionId,
        finalError: error.message
      }, 'Job permanently failed after all retry attempts');
    }
  });
  
  worker.on('error', (error) => {
    logger.error({ err: error }, 'Worker error');
  });
  
  // Log stalled jobs (jobs that haven't progressed)
  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled - may have crashed');
  });
  
  // Log when worker is ready
  worker.on('ready', () => {
    logger.info({
      concurrency: 5,
      maxRetries: 3,
      rateLimit: '10 jobs/second'
    }, 'Worker ready and waiting for jobs');
  });
  
  logger.info('Evaluation worker started');
  
  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down worker gracefully');
    await worker.close();
    await mongoose.connection.close();
    logger.info('Worker stopped');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  return worker;
}

// Start worker if this file is run directly
if (require.main === module) {
  startWorker().catch((error) => {
    logger.error({ err: error }, 'Failed to start worker');
    process.exit(1);
  });
}

module.exports = { startWorker, processEvaluation };
