/**
 * Evaluation Queue
 * 
 * Background job queue for processing evaluations asynchronously.
 * 
 * Why a queue?
 * - Evaluations can take 5-30 seconds (OCR + ML processing)
 * - API requests should return immediately (< 200ms)
 * - Queue decouples request handling from heavy processing
 * 
 * Architecture:
 * - API receives evaluation request → Enqueues job → Returns jobId
 * - Worker picks up job → Processes evaluation → Updates database
 * - Frontend polls status endpoint to track progress
 * 
 * Technology: BullMQ + Redis
 * - BullMQ: Robust job queue with retry, priority, rate limiting
 * - Redis: In-memory data store for queue persistence
 */

const { Queue } = require('bullmq');

/**
 * Redis connection configuration
 * 
 * Environment variables:
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional, for production)
 * - REDIS_DB: Redis database number (default: 0)
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,     // Prevent blocking on startup
};

// Log Redis configuration (hide password)
console.log('📡 Redis Configuration:', {
  host: redisConfig.host,
  port: redisConfig.port,
  db: redisConfig.db,
  hasPassword: !!redisConfig.password
});

/**
 * Evaluation Queue
 * 
 * Handles background processing of student submission evaluations.
 * 
 * Job data structure:
 * {
 *   submissionId: ObjectId,  // Submission to evaluate
 *   examId: ObjectId,        // Exam being evaluated
 *   studentId: ObjectId,     // Student who submitted
 *   triggeredBy: ObjectId,   // Teacher who triggered evaluation
 *   priority: Number         // Job priority (1-10, higher = more urgent)
 * }
 * 
 * Queue options:
 * - defaultJobOptions: Applied to all jobs unless overridden
 * - Connection: Shared Redis connection config
 */
const evaluationQueue = new Queue('evaluation', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,              // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',    // Wait longer between each retry
      delay: 5000             // Start with 5 second delay
    },
    removeOnComplete: {
      age: 24 * 3600,         // Keep completed jobs for 24 hours
      count: 1000             // Keep at most 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600      // Keep failed jobs for 7 days (debugging)
    }
  }
});

/**
 * Queue event handlers for monitoring
 * 
 * These log queue health and help debug issues.
 * In production, these would send metrics to monitoring systems.
 */
evaluationQueue.on('error', (error) => {
  console.error('❌ Evaluation Queue Error:', error.message);
});

evaluationQueue.on('waiting', (jobId) => {
  console.log(`⏳ Evaluation Job Waiting: ${jobId}`);
});

/**
 * Graceful shutdown handler
 * 
 * Ensures queue closes properly when server shuts down.
 * Prevents job data corruption.
 */
process.on('SIGTERM', async () => {
  console.log('🛑 Closing evaluation queue...');
  await evaluationQueue.close();
  console.log('✅ Evaluation queue closed');
});

process.on('SIGINT', async () => {
  console.log('🛑 Closing evaluation queue...');
  await evaluationQueue.close();
  console.log('✅ Evaluation queue closed');
});

module.exports = evaluationQueue;
