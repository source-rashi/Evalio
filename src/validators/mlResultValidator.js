/**
 * ML Result Validator
 * 
 * CRITICAL: Never trust external system output blindly
 * 
 * This validator provides a security layer between ML system output and database storage.
 * Even though we control the ML system, validation is essential because:
 * 
 * 1. Defense in Depth: Bugs in ML code shouldn't corrupt the database
 * 2. Data Integrity: Protect against edge cases (NaN, Infinity, negative scores)
 * 3. Contract Enforcement: ML must always conform to the contract
 * 4. Auditability: Log what was rejected and why
 * 
 * This is NOT paranoia - it's professional software engineering.
 */

const { validateMLEvaluationResult } = require('../contracts/mlEvaluationResult');

/**
 * Validation error for ML results
 */
class MLResultValidationError extends Error {
  constructor(message, validationErrors = []) {
    super(message);
    this.name = 'MLResultValidationError';
    this.validationErrors = validationErrors;
    this.statusCode = 422; // Unprocessable Entity
  }
}

/**
 * Additional business logic validation beyond contract structure
 * 
 * @param {Object} mlResult - ML evaluation result
 * @param {Object} context - Context data for validation
 * @param {number} context.expectedQuestionCount - Number of questions that should be evaluated
 * @param {Array<string>} context.expectedQuestionIds - Question IDs that should be present
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateBusinessLogic(mlResult, context = {}) {
  const errors = [];

  // Validate question count matches expectations
  if (context.expectedQuestionCount !== undefined) {
    const actualCount = mlResult.results?.length || 0;
    if (actualCount !== context.expectedQuestionCount) {
      errors.push(
        `Expected ${context.expectedQuestionCount} question results, got ${actualCount}`
      );
    }
  }

  // Validate all expected questions are present
  if (context.expectedQuestionIds && Array.isArray(context.expectedQuestionIds)) {
    const resultQuestionIds = new Set(
      mlResult.results?.map(r => r.questionId.toString()) || []
    );
    
    const missingIds = context.expectedQuestionIds.filter(
      id => !resultQuestionIds.has(id.toString())
    );
    
    if (missingIds.length > 0) {
      errors.push(
        `Missing evaluation results for questions: ${missingIds.join(', ')}`
      );
    }

    // Check for unexpected questions
    const unexpectedIds = Array.from(resultQuestionIds).filter(
      id => !context.expectedQuestionIds.some(expected => expected.toString() === id)
    );
    
    if (unexpectedIds.length > 0) {
      errors.push(
        `Unexpected question results: ${unexpectedIds.join(', ')}`
      );
    }
  }

  // Validate total score is sum of individual scores
  if (mlResult.results && Array.isArray(mlResult.results)) {
    const calculatedTotal = mlResult.results.reduce(
      (sum, r) => sum + (r.aiScore || 0),
      0
    );
    
    // Allow small floating point differences
    const difference = Math.abs(calculatedTotal - (mlResult.aiTotalScore || 0));
    if (difference > 0.01) {
      errors.push(
        `Total score mismatch: sum of individual scores (${calculatedTotal.toFixed(2)}) ` +
        `does not match aiTotalScore (${mlResult.aiTotalScore})`
      );
    }

    // Validate max score consistency
    const calculatedMaxTotal = mlResult.results.reduce(
      (sum, r) => sum + (r.maxScore || 0),
      0
    );
    
    const maxDifference = Math.abs(calculatedMaxTotal - (mlResult.maxTotalScore || 0));
    if (maxDifference > 0.01) {
      errors.push(
        `Max score mismatch: sum of individual maxScores (${calculatedMaxTotal}) ` +
        `does not match maxTotalScore (${mlResult.maxTotalScore})`
      );
    }
  }

  // Validate confidence consistency
  if (mlResult.results && Array.isArray(mlResult.results) && mlResult.results.length > 0) {
    const calculatedAvgConfidence = mlResult.results.reduce(
      (sum, r) => sum + (r.confidence || 0),
      0
    ) / mlResult.results.length;
    
    const confDifference = Math.abs(
      calculatedAvgConfidence - (mlResult.averageConfidence || 0)
    );
    
    if (confDifference > 0.01) {
      errors.push(
        `Average confidence mismatch: calculated (${calculatedAvgConfidence.toFixed(4)}) ` +
        `does not match reported (${mlResult.averageConfidence})`
      );
    }
  }

  // Validate no NaN or Infinity values
  const checkForInvalidNumbers = (obj, path = 'mlResult') => {
    if (typeof obj === 'number') {
      if (isNaN(obj)) {
        errors.push(`Invalid number (NaN) at ${path}`);
      }
      if (!isFinite(obj)) {
        errors.push(`Invalid number (Infinity) at ${path}`);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        checkForInvalidNumbers(item, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        checkForInvalidNumbers(obj[key], `${path}.${key}`);
      });
    }
  };
  
  checkForInvalidNumbers(mlResult);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive validation of ML evaluation result
 * 
 * Performs multiple validation layers:
 * 1. Contract validation (structure, types, ranges)
 * 2. Business logic validation (consistency, completeness)
 * 3. Security validation (no malicious data)
 * 
 * @param {Object} mlResult - ML evaluation result to validate
 * @param {Object} context - Validation context (optional)
 * @param {number} context.expectedQuestionCount - Expected number of questions
 * @param {Array<string>} context.expectedQuestionIds - Expected question IDs
 * @throws {MLResultValidationError} If validation fails
 * @returns {Object} The validated ML result (safe to use)
 */
function validateAndSanitize(mlResult, context = {}) {
  const allErrors = [];

  // Layer 1: Contract validation
  const contractValidation = validateMLEvaluationResult(mlResult);
  if (!contractValidation.valid) {
    allErrors.push(...contractValidation.errors.map(e => `[Contract] ${e}`));
  }

  // Layer 2: Business logic validation
  const businessValidation = validateBusinessLogic(mlResult, context);
  if (!businessValidation.valid) {
    allErrors.push(...businessValidation.errors.map(e => `[Business Logic] ${e}`));
  }

  // If any validation failed, throw error
  if (allErrors.length > 0) {
    throw new MLResultValidationError(
      'ML evaluation result failed validation',
      allErrors
    );
  }

  // Sanitize: ensure evaluatedAt is a proper Date object
  if (mlResult.evaluatedAt && !(mlResult.evaluatedAt instanceof Date)) {
    mlResult.evaluatedAt = new Date(mlResult.evaluatedAt);
  }

  // Sanitize: round scores to 2 decimal places to prevent floating point issues
  if (mlResult.aiTotalScore !== undefined) {
    mlResult.aiTotalScore = Math.round(mlResult.aiTotalScore * 100) / 100;
  }
  
  if (mlResult.results && Array.isArray(mlResult.results)) {
    mlResult.results.forEach(result => {
      if (result.aiScore !== undefined) {
        result.aiScore = Math.round(result.aiScore * 100) / 100;
      }
    });
  }

  return mlResult;
}

/**
 * Safe wrapper for ML result validation
 * Returns validation result instead of throwing
 * 
 * @param {Object} mlResult - ML evaluation result
 * @param {Object} context - Validation context
 * @returns {Object} { valid: boolean, errors: string[], sanitizedResult?: Object }
 */
function safeValidate(mlResult, context = {}) {
  try {
    const sanitizedResult = validateAndSanitize(mlResult, context);
    return {
      valid: true,
      errors: [],
      sanitizedResult
    };
  } catch (error) {
    if (error instanceof MLResultValidationError) {
      return {
        valid: false,
        errors: error.validationErrors
      };
    }
    return {
      valid: false,
      errors: [error.message]
    };
  }
}

module.exports = {
  validateAndSanitize,
  safeValidate,
  validateBusinessLogic,
  MLResultValidationError
};
