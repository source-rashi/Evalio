/**
 * Job Retry Safety and Idempotency
 * 
 * This document explains how the evaluation worker ensures safe retries.
 * 
 * Why Retry Safety Matters:
 * - Jobs may fail due to transient issues (network, memory, timeout)
 * - BullMQ automatically retries failed jobs (up to 3 attempts)
 * - Without proper safeguards, retries can cause:
 *   - Duplicate evaluations
 *   - Inconsistent state
 *   - Data corruption
 *   - Wasted resources
 * 
 * Idempotency Guarantees:
 * 
 * 1. Pre-Processing Check:
 *    - Before processing, check if evaluation is already completed
 *    - If completed, skip processing and return existing result
 *    - This prevents duplicate work on retry
 * 
 * 2. State Tracking:
 *    - Track attempt number in evaluation document
 *    - Update jobStatus at each stage (processing, completed, failed)
 *    - Distinguish between temporary failures (will retry) and permanent failures
 * 
 * 3. Error Recovery:
 *    - On failure, preserve partial data for debugging
 *    - Mark as 'failed' (temporary) or 'permanently_failed' (after all retries)
 *    - Only update submission status on permanent failure
 * 
 * 4. Race Condition Prevention:
 *    - Use MongoDB findOneAndUpdate for atomic updates
 *    - Check completion status before starting work
 *    - Single database transaction per state change
 * 
 * Job Lifecycle:
 * 
 * Attempt 1:
 *   1. Check if completed (idempotency) → No
 *   2. Mark as 'processing' (attempt 1)
 *   3. Fetch data, run ML, save result
 *   4. Mark as 'completed' ✅
 * 
 * Attempt 1 (with failure):
 *   1. Check if completed → No
 *   2. Mark as 'processing' (attempt 1)
 *   3. Fetch data, run ML → ERROR ❌
 *   4. Mark as 'failed', will retry
 * 
 * Attempt 2 (retry after failure):
 *   1. Check if completed → No
 *   2. Mark as 'processing' (attempt 2)
 *   3. Fetch data, run ML, save result
 *   4. Mark as 'completed' ✅
 * 
 * Attempt 3 (after retry - already completed):
 *   1. Check if completed → YES ✅
 *   2. Return existing result (skip processing)
 *   3. No duplicate work
 * 
 * Attempt 3 (final retry):
 *   1. Check if completed → No
 *   2. Mark as 'processing' (attempt 3)
 *   3. Fetch data, run ML → ERROR ❌
 *   4. Mark as 'permanently_failed' (no more retries)
 *   5. Update submission status to reflect permanent failure
 * 
 * Database States:
 * 
 * jobStatus: 'processing'
 *   - Job is currently being processed
 *   - May transition to 'completed' or 'failed'
 * 
 * jobStatus: 'completed'
 *   - Job finished successfully
 *   - Result is saved and final
 *   - Retries will skip processing (idempotent)
 * 
 * jobStatus: 'failed'
 *   - Job failed but will be retried
 *   - Temporary failure (network, timeout, etc.)
 *   - Submission still in 'pending' state
 * 
 * jobStatus: 'permanently_failed'
 *   - Job failed after all retry attempts
 *   - Permanent failure (bad data, bug, etc.)
 *   - Submission marked as 'failed'
 *   - Requires manual intervention
 * 
 * Code Examples:
 * 
 * Idempotency Check:
 * ```javascript
 * const existing = await Evaluation.findOne({ submission_id });
 * if (existing && existing.jobStatus === 'completed') {
 *   // Already done - return existing result
 *   return { ...existing, skipped: true };
 * }
 * ```
 * 
 * Atomic State Update:
 * ```javascript
 * await Evaluation.findOneAndUpdate(
 *   { submission_id },
 *   {
 *     jobStatus: 'processing',
 *     attemptNumber: job.attemptsMade + 1
 *   }
 * );
 * ```
 * 
 * Retry-Safe Error Handling:
 * ```javascript
 * const isLastAttempt = job.attemptsMade + 1 >= 3;
 * await Evaluation.findOneAndUpdate(
 *   { submission_id },
 *   {
 *     jobStatus: isLastAttempt ? 'permanently_failed' : 'failed',
 *     jobError: error.message,
 *     lastFailedAt: new Date()
 *   }
 * );
 * ```
 * 
 * Testing Retry Safety:
 * 
 * 1. Simulate failure on first attempt:
 *    - Inject error in ML service
 *    - Verify job is retried
 *    - Verify no duplicate data
 * 
 * 2. Simulate success after retry:
 *    - Fail first attempt, succeed second
 *    - Verify result is saved correctly
 *    - Verify no duplicate evaluations
 * 
 * 3. Simulate permanent failure:
 *    - Fail all 3 attempts
 *    - Verify marked as permanently_failed
 *    - Verify submission status updated
 * 
 * 4. Simulate race condition:
 *    - Process same job twice simultaneously
 *    - Verify idempotency check prevents duplicate
 *    - Verify only one result saved
 * 
 * Production Monitoring:
 * 
 * - Track retry rates (high rate indicates systemic issues)
 * - Monitor permanently failed jobs (require manual investigation)
 * - Alert on duplicate evaluations (should never happen)
 * - Review error patterns to identify root causes
 * 
 * Best Practices:
 * 
 * 1. Always check completion before processing
 * 2. Use atomic database operations
 * 3. Track attempt numbers for debugging
 * 4. Distinguish temporary vs permanent failures
 * 5. Log retry decisions with context
 * 6. Clean up partial data on failure
 * 7. Test retry scenarios thoroughly
 * 8. Monitor retry patterns in production
 */

module.exports = {
  // This file is documentation-only
  // Retry safety is implemented in evaluationWorker.js
};
