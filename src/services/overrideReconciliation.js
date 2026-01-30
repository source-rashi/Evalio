const ManualOverride = require('../models/ManualOverride');
const Evaluation = require('../models/Evaluation');

/**
 * Apply manual overrides to an evaluation
 * Updates finalScore and isOverridden flags based on ManualOverride documents
 * AI scores remain immutable for audit purposes
 * 
 * @param {ObjectId} evaluationId - The evaluation to reconcile
 * @returns {Object} Updated evaluation with reconciled scores
 */
async function applyOverridesToEvaluation(evaluationId) {
  // Fetch evaluation
  const evaluation = await Evaluation.findById(evaluationId);
  if (!evaluation) {
    throw new Error('Evaluation not found');
  }

  // Fetch all overrides for this evaluation
  const overrides = await ManualOverride.find({ evaluationId });

  // Create a map of questionId -> override for quick lookup
  const overrideMap = new Map();
  overrides.forEach(override => {
    overrideMap.set(override.questionId.toString(), override);
  });

  // Apply overrides to each question result
  let overridesApplied = 0;
  evaluation.results.forEach(result => {
    const questionIdStr = result.questionId.toString();
    const override = overrideMap.get(questionIdStr);

    if (override) {
      // Apply override: update finalScore and mark as overridden
      result.finalScore = override.overriddenScore;
      result.isOverridden = true;
      
      // Optionally update feedback if override has custom feedback
      if (override.overriddenFeedback && override.overriddenFeedback.trim()) {
        result.feedback = override.overriddenFeedback;
      }
      
      overridesApplied++;
    } else {
      // No override: finalScore = aiScore
      result.finalScore = result.aiScore;
      result.isOverridden = false;
      
      // Use AI feedback as final feedback if no override
      if (!result.feedback || result.feedback === result.aiFeedback) {
        result.feedback = result.aiFeedback;
      }
    }
  });

  // Recalculate totals
  evaluation.calculateTotals();

  // Save evaluation
  await evaluation.save();

  console.log(`✅ Reconciliation applied to evaluation ${evaluationId}`);
  console.log(`   Overrides applied: ${overridesApplied}`);
  console.log(`   AI Total: ${evaluation.aiTotalScore}, Final Total: ${evaluation.totalScore}`);

  return evaluation;
}

/**
 * Reconcile a specific question in an evaluation
 * Called after a new override is created
 * 
 * @param {ObjectId} evaluationId - The evaluation to update
 * @param {ObjectId} questionId - The question that was overridden
 * @param {Number} overriddenScore - The new score
 * @param {String} overriddenFeedback - Optional custom feedback
 * @returns {Object} Updated evaluation
 */
async function reconcileQuestion(evaluationId, questionId, overriddenScore, overriddenFeedback = null) {
  const evaluation = await Evaluation.findById(evaluationId);
  if (!evaluation) {
    throw new Error('Evaluation not found');
  }

  // Find the question result
  const questionIdStr = questionId.toString();
  const result = evaluation.results.find(r => r.questionId.toString() === questionIdStr);
  
  if (!result) {
    throw new Error('Question not found in evaluation');
  }

  // Apply override
  result.finalScore = overriddenScore;
  result.isOverridden = true;
  
  if (overriddenFeedback && overriddenFeedback.trim()) {
    result.feedback = overriddenFeedback;
  }

  // Recalculate totals
  evaluation.calculateTotals();

  // Save evaluation
  await evaluation.save();

  console.log(`✅ Question reconciled: Evaluation ${evaluationId}, Question ${questionId}`);
  console.log(`   AI Score: ${result.aiScore} → Final Score: ${result.finalScore}`);

  return evaluation;
}

/**
 * Remove an override and restore AI score
 * Used if teacher wants to undo an override
 * 
 * @param {ObjectId} evaluationId - The evaluation to update
 * @param {ObjectId} questionId - The question to restore
 * @returns {Object} Updated evaluation
 */
async function removeOverride(evaluationId, questionId) {
  const evaluation = await Evaluation.findById(evaluationId);
  if (!evaluation) {
    throw new Error('Evaluation not found');
  }

  // Find the question result
  const questionIdStr = questionId.toString();
  const result = evaluation.results.find(r => r.questionId.toString() === questionIdStr);
  
  if (!result) {
    throw new Error('Question not found in evaluation');
  }

  // Restore AI score
  result.finalScore = result.aiScore;
  result.isOverridden = false;
  result.feedback = result.aiFeedback;

  // Recalculate totals
  evaluation.calculateTotals();

  // Save evaluation
  await evaluation.save();

  console.log(`✅ Override removed: Evaluation ${evaluationId}, Question ${questionId}`);
  console.log(`   Restored to AI Score: ${result.aiScore}`);

  return evaluation;
}

module.exports = {
  applyOverridesToEvaluation,
  reconcileQuestion,
  removeOverride
};
