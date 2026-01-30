/**
 * Queue Monitoring Routes
 * 
 * Admin endpoints for monitoring background job queues.
 * 
 * These endpoints should be protected in production (admin-only).
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const ROLES = require('../constants/roles');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getFailedJobs,
  getJobCounts,
  getStuckJobs,
  retryFailedJob,
  getQueueHealth
} = require('../utils/queueMonitor');

/**
 * GET /api/queue/health
 * 
 * Get overall queue health metrics
 * 
 * Returns:
 * - Health score (0-100)
 * - Job counts by status
 * - Identified issues
 */
router.get('/health', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const health = await getQueueHealth();
  
  req.logger.info({ health }, 'Queue health checked');
  
  res.json({
    ok: true,
    health
  });
}));

/**
 * GET /api/queue/stats
 * 
 * Get detailed queue statistics
 * 
 * Returns job counts by status
 */
router.get('/stats', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const counts = await getJobCounts();
  
  res.json({
    ok: true,
    stats: counts
  });
}));

/**
 * GET /api/queue/failed
 * 
 * Get list of failed jobs
 * 
 * Query params:
 * - limit: Max number of jobs to return (default: 10)
 */
router.get('/failed', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const failed = await getFailedJobs(limit);
  
  res.json({
    ok: true,
    count: failed.length,
    jobs: failed
  });
}));

/**
 * GET /api/queue/stuck
 * 
 * Get list of stuck/stalled jobs
 * 
 * Returns jobs that have been processing for too long
 */
router.get('/stuck', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const stuck = await getStuckJobs();
  
  res.json({
    ok: true,
    count: stuck.length,
    jobs: stuck
  });
}));

/**
 * POST /api/queue/retry/:jobId
 * 
 * Manually retry a failed job
 * 
 * Params:
 * - jobId: Job ID to retry
 */
router.post('/retry/:jobId', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  await retryFailedJob(req.params.jobId);
  
  req.logger.info({ jobId: req.params.jobId }, 'Job manually retried');
  
  res.json({
    ok: true,
    message: 'Job retry initiated',
    jobId: req.params.jobId
  });
}));

module.exports = router;
