/**
 * ML Adapter Interface
 * 
 * This module provides the interface between the backend and the ML evaluation system.
 * It defines HOW the backend communicates with ML, but NOT how ML works internally.
 * 
 * Purpose:
 * - Decouples backend from ML implementation details
 * - Allows swapping ML systems without changing backend code
 * - Provides clear contract for input/output
 * 
 * Design Pattern: ADAPTER PATTERN
 * - Backend doesn't care if ML is Python, R, or a cloud service
 * - Backend only cares: "Give me input, get me valid output"
 * 
 * Future Implementation:
 * - This will call Python ML system via subprocess/HTTP/queue
 * - For now, it's a placeholder that validates contracts
 */

const { validateMLEvaluationResult } = require('../contracts/mlEvaluationResult');

/**
 * NotImplementedError - thrown when ML adapter is called before implementation
 */
class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotImplementedError';
    this.statusCode = 501; // HTTP 501: Not Implemented
  }
}

/**
 * Input validation for ML evaluation request
 * 
 * @param {Object} input - Evaluation input data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateEvaluationInput(input) {
  const errors = [];

  // Check top-level structure
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: ['Input must be an object']
    };
  }

  // Validate submission
  if (!input.submission) {
    errors.push('submission is required');
  } else {
    if (!input.submission._id) {
      errors.push('submission._id is required');
    }
    if (!input.submission.student_id) {
      errors.push('submission.student_id is required');
    }
  }

  // Validate exam
  if (!input.exam) {
    errors.push('exam is required');
  } else {
    if (!input.exam._id) {
      errors.push('exam._id is required');
    }
  }

  // Validate questions array
  if (!Array.isArray(input.questions)) {
    errors.push('questions must be an array');
  } else {
    if (input.questions.length === 0) {
      errors.push('questions array cannot be empty');
    }

    input.questions.forEach((q, index) => {
      if (!q._id) {
        errors.push(`questions[${index}]._id is required`);
      }
      if (!q.modelAnswer) {
        errors.push(`questions[${index}].modelAnswer is required`);
      }
      if (typeof q.maxScore !== 'number') {
        errors.push(`questions[${index}].maxScore must be a number`);
      }
      if (!Array.isArray(q.rubric)) {
        errors.push(`questions[${index}].rubric must be an array`);
      }
    });
  }

  // Validate answers array
  if (!Array.isArray(input.answers)) {
    errors.push('answers must be an array');
  } else {
    if (input.answers.length !== input.questions?.length) {
      errors.push('answers array length must match questions array length');
    }

    input.answers.forEach((answer, index) => {
      if (!answer.questionId) {
        errors.push(`answers[${index}].questionId is required`);
      }
      if (typeof answer.studentAnswer !== 'string') {
        errors.push(`answers[${index}].studentAnswer must be a string`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Evaluate student answers using ML system
 * 
 * THIS FUNCTION IS NOT YET IMPLEMENTED
 * 
 * When implemented, this function will:
 * 1. Validate input data
 * 2. Transform input to ML system format
 * 3. Call Python ML evaluation system (subprocess/HTTP/queue)
 * 4. Receive ML results
 * 5. Validate output against contract
 * 6. Return validated results to backend
 * 
 * INPUT STRUCTURE:
 * {
 *   submission: {
 *     _id: ObjectId,
 *     student_id: ObjectId,
 *     exam_id: ObjectId
 *   },
 *   exam: {
 *     _id: ObjectId,
 *     title: string,
 *     subject: string
 *   },
 *   questions: [
 *     {
 *       _id: ObjectId,
 *       questionText: string,
 *       modelAnswer: string,
 *       maxScore: number,
 *       rubric: [
 *         {
 *           keypoint: string,
 *           keywords: string[],
 *           weight: number
 *         }
 *       ]
 *     }
 *   ],
 *   answers: [
 *     {
 *       questionId: ObjectId,
 *       studentAnswer: string,
 *       imageUrl?: string
 *     }
 *   ]
 * }
 * 
 * OUTPUT STRUCTURE:
 * Must conform to MLEvaluationResult contract (see src/contracts/mlEvaluationResult.js)
 * 
 * @param {Object} input - Evaluation request data
 * @returns {Promise<MLEvaluationResult>} ML evaluation results
 * @throws {NotImplementedError} Always (until implementation is added)
 * @throws {Error} If input validation fails
 */
async function evaluateAnswers(input) {
  // Step 1: Validate input structure
  const validation = validateEvaluationInput(input);
  if (!validation.valid) {
    const error = new Error('Invalid evaluation input: ' + validation.errors.join(', '));
    error.validationErrors = validation.errors;
    error.statusCode = 400;
    throw error;
  }

  // Step 2: Throw NotImplementedError
  // This prevents accidental use before ML integration is complete
  throw new NotImplementedError(
    'ML evaluation system not yet integrated. ' +
    'This adapter interface is ready, but the actual ML execution is not implemented. ' +
    'To complete integration: implement Python subprocess call or HTTP request to ML service.'
  );

  // Future implementation will go here:
  // 
  // // Transform input to ML format
  // const mlInput = transformToMLFormat(input);
  // 
  // // Call Python ML system
  // const mlRawResult = await callPythonML(mlInput);
  // 
  // // Validate ML output
  // const outputValidation = validateMLEvaluationResult(mlRawResult);
  // if (!outputValidation.valid) {
  //   throw new Error('ML returned invalid result: ' + outputValidation.errors.join(', '));
  // }
  // 
  // return mlRawResult;
}

/**
 * Check if ML adapter is implemented
 * 
 * @returns {boolean} True if ML system is ready, false if still using stub
 */
function isMLImplemented() {
  return false; // Will return true once implementation is complete
}

/**
 * Get adapter status and metadata
 * 
 * @returns {Object} Status information
 */
function getAdapterStatus() {
  return {
    implemented: isMLImplemented(),
    version: '1.0.0',
    mode: 'interface_only',
    mlSystemType: 'python_subprocess', // Planned implementation
    note: 'Adapter interface ready. ML execution pending integration.'
  };
}

module.exports = {
  evaluateAnswers,
  validateEvaluationInput,
  isMLImplemented,
  getAdapterStatus,
  NotImplementedError
};
