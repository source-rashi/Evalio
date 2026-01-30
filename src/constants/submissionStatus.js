/**
 * Submission lifecycle status constants
 * 
 * Lifecycle flow:
 * draft → finalized → evaluated
 * 
 * - draft: Student is still working on answers (can edit)
 * - finalized: Student submitted, locked (no edits), ready for grading
 * - evaluated: ML grading completed, Evaluation document created
 */

const SUBMISSION_STATUS = {
  DRAFT: 'draft',
  FINALIZED: 'finalized',
  EVALUATED: 'evaluated',
};

// Array version for Mongoose enum validation
const SUBMISSION_STATUS_VALUES = Object.values(SUBMISSION_STATUS);

module.exports = {
  SUBMISSION_STATUS,
  SUBMISSION_STATUS_VALUES,
};
