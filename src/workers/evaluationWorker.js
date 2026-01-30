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
const { gradeAnswer } = require('../services/grading');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');

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
  console.log('✅ Worker connected to MongoDB');
}

/**
 * Process a single evaluation job
 * 
 * This function contains the core evaluation logic.
 * 
 * Job data structure:
 * {
 *   submissionId: String,   // MongoDB ObjectId as string
 *   examId: String,
 *   studentId: String,
 *   triggeredBy: String
 * }
 * 
 * Steps:
 * 1. Fetch submission from database
 * 2. Fetch related questions
 * 3. Grade each answer (currently uses grading.js, will use ML later)
 * 4. Create/update Evaluation document
 * 5. Update submission status
 * 
 * @param {Object} job - BullMQ job object
 * @returns {Object} Evaluation result summary
 */
async function processEvaluation(job) {
  const { submissionId, examId, studentId } = job.data;
  
  console.log(`📝 Processing evaluation for submission: ${submissionId}`);
  console.log(`   Exam: ${examId}, Student: ${studentId}`);
  
  // Update job progress
  await job.updateProgress(10);
  
  // Step 1: Fetch submission with populated data
  const submission = await Submission.findById(submissionId)
    .populate('answers.questionId');
  
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }
  
  console.log(`   Found ${submission.answers.length} answers to grade`);
  await job.updateProgress(20);
  
  // Step 2: Fetch all questions for this exam
  const questionIds = submission.answers.map(a => a.questionId?._id).filter(Boolean);
  const questions = await Question.find({ _id: { $in: questionIds } });
  const questionMap = new Map(questions.map(q => [String(q._id), q]));
  
  await job.updateProgress(30);
  
  // Step 3: Grade each answer
  const results = [];
  let totalScore = 0;
  let maxScore = 0;
  
  for (let i = 0; i < submission.answers.length; i++) {
    const answer = submission.answers[i];
    const question = questionMap.get(String(answer.questionId?._id || answer.questionId));
    
    if (!question) {
      console.warn(`   ⚠️  Question not found: ${answer.questionId}`);
      continue;
    }
    
    const questionMaxScore = question.marks || 5;
    maxScore += questionMaxScore;
    
    // Grade the answer (currently uses old grading service)
    // TODO: Replace with ML adapter in future
    const gradingResult = await gradeAnswer({
      modelAnswer: question.modelAnswer || '',
      studentAnswer: answer.extractedText || '',
      maxScore: questionMaxScore,
      keypoints: question.keypoints || []
    });
    
    // Map to new evaluation schema
    results.push({
      questionId: answer.questionId,
      aiScore: gradingResult.score || 0,
      finalScore: gradingResult.score || 0,
      maxScore: questionMaxScore,
      aiFeedback: gradingResult.feedback || '',
      feedback: gradingResult.feedback || '',
      confidence: gradingResult.confidence || 0.5,
      isOverridden: false
    });
    
    totalScore += gradingResult.score || 0;
    
    // Update progress incrementally
    const progress = 30 + Math.floor((i + 1) / submission.answers.length * 60);
    await job.updateProgress(progress);
  }
  
  console.log(`   Grading complete: ${totalScore}/${maxScore}`);
  
  // Step 4: Create or update Evaluation document
  const averageConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
    : 0;
  
  const evaluation = await Evaluation.findOneAndUpdate(
    { submission_id: submissionId },
    {
      submission_id: submissionId,
      results,
      aiTotalScore: totalScore,
      totalScore,
      status: EVALUATION_STATUS.AI_EVALUATED,
      averageConfidence,
      evaluatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  
  console.log(`   ✅ Evaluation saved: ${evaluation._id}`);
  await job.updateProgress(95);
  
  // Step 5: Update submission status
  submission.status = SUBMISSION_STATUS.EVALUATED;
  await submission.save();
  
  await job.updateProgress(100);
  
  return {
    evaluationId: evaluation._id,
    score: totalScore,
    maxScore,
    questionsGraded: results.length
  };
}

/**
 * Create and start the evaluation worker
 */
async function startWorker() {
  console.log('🚀 Starting Evaluation Worker...');
  console.log('📡 Redis:', `${redisConfig.host}:${redisConfig.port}`);
  
  // Connect to database first
  await connectDatabase();
  
  // Create worker instance
  const worker = new Worker('evaluation', async (job) => {
    console.log(`\n🔄 Job Started: ${job.id}`);
    console.log(`   Data:`, job.data);
    
    try {
      const result = await processEvaluation(job);
      console.log(`✅ Job Completed: ${job.id}`);
      console.log(`   Result:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ Job Failed: ${job.id}`);
      console.error(`   Error: ${error.message}`);
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
