/**
 * Centralized constants export
 * Import all constants from a single entry point
 */

const ROLES = require('./roles');
const { SUBMISSION_STATUS, SUBMISSION_STATUS_VALUES } = require('./submissionStatus');
const { EVALUATION_STATUS, EVALUATION_STATUS_VALUES } = require('./evaluationStatus');

module.exports = {
  ROLES,
  SUBMISSION_STATUS,
  SUBMISSION_STATUS_VALUES,
  EVALUATION_STATUS,
  EVALUATION_STATUS_VALUES,
};
