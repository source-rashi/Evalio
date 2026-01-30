const mongoose = require('mongoose');

/**
 * ManualOverride Model
 * Tracks teacher corrections to AI-generated scores
 * Provides full audit trail for accountability and trust
 * 
 * Lifecycle:
 * 1. AI generates initial evaluation with aiScore
 * 2. Teacher reviews and creates override if needed
 * 3. Evaluation.finalScore updated, isOverridden = true
 * 4. This model preserves the change history
 */
const ManualOverrideSchema = new mongoose.Schema({
  // Reference to the evaluation being overridden
  evaluationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evaluation',
    required: true,
    index: true
  },
  
  // Specific question being overridden (optional for overall overrides)
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
    index: true
  },
  
  // Original AI-generated score (for comparison)
  originalScore: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Teacher's corrected score
  overriddenScore: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Maximum possible score for this question
  maxScore: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Teacher's explanation for the override
  reason: {
    type: String,
    required: [true, 'Reason for override is required'],
    minlength: [10, 'Reason must be at least 10 characters'],
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  
  // Original AI feedback (preserved)
  originalFeedback: {
    type: String,
    default: ''
  },
  
  // Teacher's updated feedback
  overriddenFeedback: {
    type: String,
    default: ''
  },
  
  // Teacher who made the override (for accountability)
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // When the override was created
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for efficient queries
ManualOverrideSchema.index({ evaluationId: 1, questionId: 1 });
ManualOverrideSchema.index({ teacherId: 1, createdAt: -1 });

// Virtual: Calculate the score difference
ManualOverrideSchema.virtual('scoreDifference').get(function() {
  return this.overriddenScore - this.originalScore;
});

// Virtual: Calculate percentage change
ManualOverrideSchema.virtual('percentageChange').get(function() {
  if (this.originalScore === 0) return this.overriddenScore > 0 ? 100 : 0;
  return ((this.overriddenScore - this.originalScore) / this.originalScore) * 100;
});

// Static method: Get all overrides for an evaluation
ManualOverrideSchema.statics.findByEvaluation = function(evaluationId) {
  return this.find({ evaluationId })
    .populate('questionId', 'text marks')
    .populate('teacherId', 'name email')
    .sort({ createdAt: -1 });
};

// Static method: Get all overrides by a teacher
ManualOverrideSchema.statics.findByTeacher = function(teacherId, limit = 50) {
  return this.find({ teacherId })
    .populate('evaluationId')
    .populate('questionId', 'text')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method: Get override statistics for an evaluation
ManualOverrideSchema.statics.getEvaluationStats = async function(evaluationId) {
  const overrides = await this.find({ evaluationId });
  
  if (overrides.length === 0) {
    return {
      totalOverrides: 0,
      averageScoreChange: 0,
      questionsOverridden: 0
    };
  }
  
  const totalScoreChange = overrides.reduce((sum, o) => sum + (o.overriddenScore - o.originalScore), 0);
  const uniqueQuestions = new Set(overrides.map(o => String(o.questionId)));
  
  return {
    totalOverrides: overrides.length,
    averageScoreChange: totalScoreChange / overrides.length,
    questionsOverridden: uniqueQuestions.size,
    totalScoreDifference: totalScoreChange
  };
};

// Ensure virtuals are included in JSON
ManualOverrideSchema.set('toJSON', { virtuals: true });
ManualOverrideSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ManualOverride', ManualOverrideSchema);
