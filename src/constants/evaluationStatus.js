/**
 * Evaluation status constants
 * Reserved for future evaluation workflow enhancements
 * 
 * Planned lifecycle:
 * pending → ai_evaluated → manually_reviewed → finalized
 * 
 * - pending: Evaluation request queued (future use)
 * - ai_evaluated: ML model completed grading
 * - manually_reviewed: Teacher manually reviewed/adjusted scores
 * - finalized: Grades locked and published to student
 * 
 * Note: Current implementation does not yet use these statuses.
 * Evaluations are created directly without status tracking.
 */

const EVALUATION_STATUS = {
  PENDING: 'pending',
  AI_EVALUATED: 'ai_evaluated',
  MANUALLY_REVIEWED: 'manually_reviewed',
  FINALIZED: 'finalized',
};

// Array version for future Mongoose enum validation
const EVALUATION_STATUS_VALUES = Object.values(EVALUATION_STATUS);

module.exports = {
  EVALUATION_STATUS,
  EVALUATION_STATUS_VALUES,
};
