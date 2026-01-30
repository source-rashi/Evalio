/**
 * ML Output Mapper
 * 
 * Maps ML evaluation results into Evaluation model format.
 * This is the bridge between ML output and database schema.
 * 
 * WHY THIS EXISTS:
 * - ML output structure ≠ MongoDB Evaluation schema
 * - Mapping layer prevents database corruption
 * - Backend remains authoritative over data structure
 * - Preserves immutability of AI scores
 * 
 * WORKFLOW:
 * 1. Receive validated ML result (from validator)
 * 2. Transform to Evaluation schema format
 * 3. Set proper status (ai_evaluated)
 * 4. Preserve aiScore immutability
 * 5. Return ready-to-save Evaluation data
 */

const { validateAndSanitize } = require('../validators/mlResultValidator');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');

/**
 * Map ML result to Evaluation model format
 * 
 * Transforms the ML system's output into the structure expected by
 * the Evaluation MongoDB model. Validates the ML result first.
 * 
 * @param {Object} mlResult - Raw ML evaluation result
 * @param {Object} context - Mapping context
 * @param {string} context.submissionId - Submission being evaluated
 * @param {string} context.examId - Exam being evaluated (optional)
 * @param {number} context.expectedQuestionCount - Expected number of questions
 * @param {Array<string>} context.expectedQuestionIds - Expected question IDs
 * @returns {Object} Evaluation data ready for MongoDB save
 * @throws {Error} If ML result is invalid
 * 
 * @example
 * const evaluationData = mapMLResultToEvaluation(mlResult, {
 *   submissionId: '507f1f77bcf86cd799439011',
 *   expectedQuestionCount: 5,
 *   expectedQuestionIds: ['507f...', '507f...']
 * });
 * 
 * // Result can be used directly:
 * await Evaluation.create(evaluationData);
 */
function mapMLResultToEvaluation(mlResult, context = {}) {
  // Step 1: Validate ML result using Phase 4 validator
  const validatedResult = validateAndSanitize(mlResult, {
    expectedQuestionCount: context.expectedQuestionCount,
    expectedQuestionIds: context.expectedQuestionIds
  });

  // Step 2: Map per-question results to Evaluation.results schema
  const results = validatedResult.results.map(questionResult => ({
    questionId: questionResult.questionId,
    
    // AI-generated score (immutable, never changes)
    aiScore: questionResult.aiScore,
    
    // Final score (initially equals aiScore, may be overridden by teacher)
    finalScore: questionResult.aiScore,
    
    // Maximum possible score
    maxScore: questionResult.maxScore,
    
    // AI-generated feedback (immutable, preserved for audit)
    aiFeedback: questionResult.aiFeedback || '',
    
    // Final feedback (initially equals aiFeedback, may be overridden)
    feedback: questionResult.aiFeedback || '',
    
    // AI confidence level (0.0 to 1.0)
    confidence: questionResult.confidence,
    
    // Override flag (initially false, set to true if teacher overrides)
    isOverridden: false,
    
    // Optional: Store matched/missing keypoints for transparency
    metadata: {
      matchedKeypoints: questionResult.matchedKeypoints || [],
      missingKeypoints: questionResult.missingKeypoints || [],
      mlMetadata: questionResult.metadata || {}
    }
  }));

  // Step 3: Build Evaluation document structure
  const evaluationData = {
    submission_id: context.submissionId,
    
    // Per-question results array
    results: results,
    
    // AI-calculated total score (immutable)
    aiTotalScore: validatedResult.aiTotalScore,
    
    // Final total score (initially equals aiTotalScore)
    totalScore: validatedResult.aiTotalScore,
    
    // Average confidence across all questions
    averageConfidence: validatedResult.averageConfidence,
    
    // Overall feedback (if ML provides it)
    overallFeedback: validatedResult.overallFeedback || '',
    
    // Evaluation status (ai_evaluated after ML completes)
    status: EVALUATION_STATUS.AI_EVALUATED,
    
    // Timestamp when ML evaluation completed
    evaluatedAt: new Date(),
    
    // ML system metadata for debugging/auditing
    systemMetadata: {
      mlMethod: validatedResult.method || 'unknown',
      mlVersion: validatedResult.systemMetadata?.mlVersion || 'unknown',
      evaluatedAt: validatedResult.evaluatedAt || new Date(),
      ...validatedResult.systemMetadata
    }
  };

  return evaluationData;
}

/**
 * Update existing Evaluation with ML results
 * 
 * Used when updating a PENDING evaluation with ML results.
 * Preserves existing fields and only updates AI-related fields.
 * 
 * @param {Object} existingEvaluation - Existing Evaluation document
 * @param {Object} mlResult - Validated ML result
 * @returns {Object} Updated evaluation data
 */
function updateEvaluationWithMLResult(existingEvaluation, mlResult) {
  const validatedResult = validateAndSanitize(mlResult);

  // Map results
  const results = validatedResult.results.map(questionResult => ({
    questionId: questionResult.questionId,
    aiScore: questionResult.aiScore,
    finalScore: questionResult.aiScore, // Initially equals aiScore
    maxScore: questionResult.maxScore,
    aiFeedback: questionResult.aiFeedback || '',
    feedback: questionResult.aiFeedback || '',
    confidence: questionResult.confidence,
    isOverridden: false,
    metadata: {
      matchedKeypoints: questionResult.matchedKeypoints || [],
      missingKeypoints: questionResult.missingKeypoints || [],
      mlMetadata: questionResult.metadata || {}
    }
  }));

  // Update evaluation fields
  existingEvaluation.results = results;
  existingEvaluation.aiTotalScore = validatedResult.aiTotalScore;
  existingEvaluation.totalScore = validatedResult.aiTotalScore;
  existingEvaluation.averageConfidence = validatedResult.averageConfidence;
  existingEvaluation.overallFeedback = validatedResult.overallFeedback || '';
  existingEvaluation.status = EVALUATION_STATUS.AI_EVALUATED;
  existingEvaluation.evaluatedAt = new Date();

  if (!existingEvaluation.systemMetadata) {
    existingEvaluation.systemMetadata = {};
  }
  
  Object.assign(existingEvaluation.systemMetadata, {
    mlMethod: validatedResult.method || 'unknown',
    mlVersion: validatedResult.systemMetadata?.mlVersion || 'unknown',
    evaluatedAt: validatedResult.evaluatedAt || new Date(),
    ...validatedResult.systemMetadata
  });

  return existingEvaluation;
}

/**
 * Verify AI score immutability
 * 
 * Ensures that aiScore field is never modified after initial ML evaluation.
 * This is a safety check for audit compliance.
 * 
 * @param {Object} evaluation - Evaluation document
 * @returns {boolean} True if aiScores are immutable, false if corrupted
 */
function verifyAIScoreImmutability(evaluation) {
  if (!evaluation.results || evaluation.results.length === 0) {
    return true; // No results yet
  }

  // Check that each result has aiScore set
  for (const result of evaluation.results) {
    if (typeof result.aiScore !== 'number') {
      return false; // aiScore not set or not a number
    }
    
    if (result.aiScore < 0) {
      return false; // Invalid aiScore
    }
  }

  return true;
}

/**
 * Calculate score statistics
 * 
 * Provides statistics about the evaluation for logging/monitoring.
 * 
 * @param {Object} evaluationData - Evaluation data
 * @returns {Object} Statistics
 */
function calculateEvaluationStats(evaluationData) {
  if (!evaluationData.results || evaluationData.results.length === 0) {
    return {
      questionCount: 0,
      averageScore: 0,
      averageConfidence: 0,
      totalScore: 0,
      maxPossibleScore: 0,
      scorePercentage: 0
    };
  }

  const questionCount = evaluationData.results.length;
  const totalScore = evaluationData.aiTotalScore || 0;
  const maxPossibleScore = evaluationData.results.reduce((sum, r) => sum + (r.maxScore || 0), 0);
  const averageConfidence = evaluationData.averageConfidence || 0;

  return {
    questionCount,
    totalScore,
    maxPossibleScore,
    scorePercentage: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
    averageScore: questionCount > 0 ? totalScore / questionCount : 0,
    averageConfidence: Math.round(averageConfidence * 100)
  };
}

module.exports = {
  mapMLResultToEvaluation,
  updateEvaluationWithMLResult,
  verifyAIScoreImmutability,
  calculateEvaluationStats
};
