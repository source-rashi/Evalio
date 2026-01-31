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
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
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
 * Get list of failed jobs with pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get('/failed', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req);
  
  // Get all failed jobs (queue library doesn't support pagination natively)
  const allFailed = await getFailedJobs(1000); // Get a large batch
  const total = allFailed.length;
  
  // Manual pagination
  const skip = (page - 1) * limit;
  const paginatedJobs = allFailed.slice(skip, skip + limit);
  
  const response = buildPaginationResponse(paginatedJobs, total, page, limit);
  res.json({
    ok: true,
    jobs: response.items,
    pagination: response.pagination
  });
}));

/**
 * GET /api/queue/stuck
 * 
 * Get list of stuck/stalled jobs with pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * Returns jobs that have been processing for too long
 */
router.get('/stuck', auth, requireRole(ROLES.TEACHER), asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req);
  
  // Get all stuck jobs
  const allStuck = await getStuckJobs();
  const total = allStuck.length;
  
  // Manual pagination
  const skip = (page - 1) * limit;
  const paginatedJobs = allStuck.slice(skip, skip + limit);
  
  const response = buildPaginationResponse(paginatedJobs, total, page, limit);
  res.json({
    ok: true,
    jobs: response.items,
    pagination: response.pagination
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
