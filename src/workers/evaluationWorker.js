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
 *   triggeredBy: String
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
  const { submissionId, examId, studentId } = job.data;
  
  logger.info({ submissionId, examId, studentId }, 'Processing evaluation');
  
  // Update evaluation status to "processing"
  await Evaluation.findOneAndUpdate(
    { submission_id: submissionId },
    {
      jobStatus: 'processing',
      processingStartedAt: new Date()
    }
  );
  
  await job.updateProgress(10);
  
  // Step 1: Fetch submission with answers
  const submission = await Submission.findById(submissionId);
  
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }
  
  logger.debug({ answerCount: submission.answers.length }, 'Found answers to evaluate');
  await job.updateProgress(15);
  
  // Step 2: Fetch exam details
  const exam = await Exam.findById(examId);
  
  if (!exam) {
    throw new Error(`Exam not found: ${examId}`);
  }
  
  logger.debug({ examTitle: exam.title }, 'Exam details fetched');
  await job.updateProgress(20);
  
  // Step 3: Fetch all questions for this exam
  const questionIds = submission.answers.map(a => a.question_id).filter(Boolean);
  const questions = await Question.find({ _id: { $in: questionIds } });
  
  if (questions.length === 0) {
    throw new Error(`No questions found for exam: ${examId}`);
  }
  
  logger.debug({ questionCount: questions.length }, 'Questions fetched');
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
  logger.debug({ inputStats }, 'ML input prepared');
  await job.updateProgress(40);
  
  // Step 5: Execute Python ML engine
  logger.info('Executing Python ML engine');
  const mlResult = await executePythonML(mlInput, {
    timeout: 60000 // 60 second timeout for ML execution
  });
  
  logger.info('ML execution complete');
  await job.updateProgress(70);
  
  // Step 6: Map ML output to Evaluation model
  const evaluationData = mapMLResultToEvaluation(mlResult, {
    submissionId: submissionId,
    examId: examId,
    expectedQuestionCount: questions.length,
    expectedQuestionIds: questions.map(q => String(q._id))
  });
  
  const evalStats = calculateEvaluationStats(evaluationData);
  logger.debug({ evalStats }, 'Evaluation statistics calculated');
  await job.updateProgress(80);
  
  // Step 7: Save evaluation to database
  const evaluation = await Evaluation.findOneAndUpdate(
    { submission_id: submissionId },
    evaluationData,
    { upsert: true, new: true }
  );
  
  logger.info({ evaluationId: evaluation._id }, 'Evaluation saved to database');
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
  
  logger.info({
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
    logger.logJob(job, 'Job started');
    
    try {
      const result = await processEvaluation(job);
      logger.logJob(job, 'Job completed', { result });
      return result;
      
    } catch (error) {
      logger.logError(error, 'Job failed', { jobId: job.id, data: job.data });
      
      // Update evaluation to mark job as failed
      const { submissionId } = job.data;
      await Evaluation.findOneAndUpdate(
        { submission_id: submissionId },
        {
          jobStatus: 'failed',
          jobError: error.message
        }
      );
      
      throw error; // Re-throw to trigger retry
    }
  }, {
    connection: redisConfig,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10,      // Max 10 jobs
      duration: 1000 // Per second
    }
  });
  
  // Worker event handlers
  worker.on('completed', (job, result) => {
    console.log(`\n✨ Job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`\n💥 Job ${job.id} failed after ${job.attemptsMade} attempts`);
    console.error(`   Error: ${error.message}`);
  });
  
  worker.on('error', (error) => {
    console.error('❌ Worker Error:', error.message);
  });
  
  console.log('✅ Worker is running and waiting for jobs...');
  console.log('📊 Concurrency:', 5);
  console.log('🔄 Retry attempts:', 3);
  console.log('\nPress Ctrl+C to stop\n');
  
  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    await worker.close();
    await mongoose.connection.close();
    console.log('✅ Worker stopped');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  return worker;
}

// Start worker if this file is run directly
if (require.main === module) {
  startWorker().catch((error) => {
    console.error('💥 Failed to start worker:', error.message);
    process.exit(1);
  });
}

module.exports = { startWorker, processEvaluation };
