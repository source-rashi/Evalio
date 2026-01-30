/**
 * Queue Monitoring Utilities
 * 
 * Tools for monitoring and debugging background job queues.
 * 
 * Why queue monitoring?
 * - Visibility into job processing and failures
 * - Debugging stuck or failed jobs
 * - Performance metrics and bottleneck detection
 * - Production incident response
 * 
 * Usage:
 *   const { getFailedJobs, getJobCounts } = require('./queueMonitor');
 *   const failed = await getFailedJobs(10);
 *   const counts = await getJobCounts();
 */

const evaluationQueue = require('../queues/evaluationQueue');
const logger = require('../utils/logger');

/**
 * Get failed jobs from the queue
 * 
 * Returns detailed information about failed jobs for debugging.
 * 
 * @param {number} limit - Maximum number of jobs to return (default: 10)
 * @returns {Promise<Array>} Failed jobs with error details
 */
async function getFailedJobs(limit = 10) {
  try {
    const failed = await evaluationQueue.getFailed(0, limit - 1);
    
    return failed.map(job => ({
      id: job.id,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      processedOn: job.processedOn ? new Date(job.processedOn) : null
    }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch failed jobs');
    throw error;
  }
}

/**
 * Get job counts by status
 * 
 * Returns counts of jobs in different states for monitoring.
 * 
 * @returns {Promise<Object>} Job counts by status
 */
async function getJobCounts() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      evaluationQueue.getWaitingCount(),
      evaluationQueue.getActiveCount(),
      evaluationQueue.getCompletedCount(),
      evaluationQueue.getFailedCount(),
      evaluationQueue.getDelayedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch job counts');
    throw error;
  }
}

/**
 * Get stuck jobs (stalled or taking too long)
 * 
 * Returns jobs that may be stuck or stalled.
 * 
 * @returns {Promise<Array>} Potentially stuck jobs
 */
async function getStuckJobs() {
  try {
    const active = await evaluationQueue.getActive();
    const now = Date.now();
    const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    const stuck = active.filter(job => {
      const processingTime = now - (job.processedOn || now);
      return processingTime > STUCK_THRESHOLD;
    });
    
    return stuck.map(job => ({
      id: job.id,
      data: job.data,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      processingTime: now - (job.processedOn || now),
      attemptsMade: job.attemptsMade
    }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch stuck jobs');
    throw error;
  }
}

/**
 * Retry a specific failed job
 * 
 * Manually retry a failed job by ID.
 * 
 * @param {string} jobId - Job ID to retry
 * @returns {Promise<void>}
 */
async function retryFailedJob(jobId) {
  try {
    const job = await evaluationQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    if (await job.isFailed()) {
      await job.retry();
      logger.info({ jobId }, 'Job retried manually');
    } else {
      throw new Error(`Job ${jobId} is not in failed state`);
    }
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to retry job');
    throw error;
  }
}

/**
 * Clean old completed jobs
 * 
 * Remove completed jobs older than specified age.
 * 
 * @param {number} maxAge - Max age in milliseconds (default: 24 hours)
 * @returns {Promise<number>} Number of jobs removed
 */
async function cleanOldJobs(maxAge = 24 * 60 * 60 * 1000) {
  try {
    const grace = 0; // No grace period
    const limit = 1000; // Clean in batches
    
    const removed = await evaluationQueue.clean(maxAge, limit, 'completed');
    
    logger.info({ removed, maxAge }, 'Cleaned old completed jobs');
    return removed.length;
  } catch (error) {
    logger.error({ err: error }, 'Failed to clean old jobs');
    throw error;
  }
}

/**
 * Get queue health metrics
 * 
 * Returns overall queue health and performance metrics.
 * 
 * @returns {Promise<Object>} Queue health metrics
 */
async function getQueueHealth() {
  try {
    const counts = await getJobCounts();
    const stuck = await getStuckJobs();
    const failed = await evaluationQueue.getFailedCount();
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for problems
    if (failed > 10) healthScore -= 20;
    if (failed > 50) healthScore -= 30;
    if (stuck.length > 0) healthScore -= 25;
    if (counts.waiting > 100) healthScore -= 15;
    
    return {
      healthy: healthScore >= 70,
      score: Math.max(0, healthScore),
      counts,
      stuckJobs: stuck.length,
      issues: {
        highFailureRate: failed > 10,
        stalledJobs: stuck.length > 0,
        backlogBuildup: counts.waiting > 100
      }
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to get queue health');
    throw error;
  }
}

module.exports = {
  getFailedJobs,
  getJobCounts,
  getStuckJobs,
  retryFailedJob,
  cleanOldJobs,
  getQueueHealth
};
