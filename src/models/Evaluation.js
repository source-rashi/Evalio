const mongoose = require('mongoose');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');

/**
 * ResultSchema: Per-question evaluation result
 * Supports AI scoring + manual overrides + explainability
 */
const ResultSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question',
    required: true 
  },
  
  // AI-generated score (original, never changes)
  aiScore: { 
    type: Number, 
    min: 0,
    default: 0
  },
  
  // Final score (may be overridden by teacher)
  finalScore: { 
    type: Number, 
    min: 0,
    required: true,
    default: 0
  },
  
  maxScore: { 
    type: Number, 
    required: true,
    default: 5
  },
  
  // AI-generated feedback (original, preserved)
  aiFeedback: { 
    type: String, 
    default: '' 
  },
  
  // Final feedback (may include teacher comments)
  feedback: { 
    type: String, 
    default: '' 
  },
  
  // AI confidence level (0-1, for explainability)
  confidence: { 
    type: Number, 
    min: 0, 
    max: 1,
    default: 0
  },
  
  // Whether this result was manually overridden
  isOverridden: { 
    type: Boolean, 
    default: false 
  }
});

/**
 * EvaluationSchema: Complete evaluation of a submission
 * Tracks AI scores, manual overrides, and lifecycle status
 */
const EvaluationSchema = new mongoose.Schema({
  submission_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Submission',
    required: true,
    index: true
  },
  
  // Per-question results
  results: [ResultSchema],
  
  // AI-calculated total (sum of aiScores)
  aiTotalScore: { 
    type: Number, 
    default: 0 
  },
  
  // Final total score (sum of finalScores, may differ from AI)
  totalScore: { 
    type: Number, 
    default: 0 
  },
  
  // Overall AI feedback
  overallFeedback: { 
    type: String, 
    default: '' 
  },
  
  // Average confidence across all questions
  averageConfidence: { 
    type: Number, 
    min: 0, 
    max: 1,
    default: 0
  },
  
  // Evaluation lifecycle status
  status: {
    type: String,
    enum: Object.values(EVALUATION_STATUS),
    default: EVALUATION_STATUS.PENDING,
    index: true
  },
  
  // Teacher who reviewed/finalized (if applicable)
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // When the evaluation was reviewed/finalized
  reviewedAt: {
    type: Date,
    default: null
  }
  
}, { timestamps: true });

// Index for efficient queries
EvaluationSchema.index({ submission_id: 1, status: 1 });

// Virtual: Check if any results were overridden
EvaluationSchema.virtual('hasOverrides').get(function() {
  return this.results.some(r => r.isOverridden);
});

// Method: Calculate totals from results
EvaluationSchema.methods.calculateTotals = function() {
  this.aiTotalScore = this.results.reduce((sum, r) => sum + (r.aiScore || 0), 0);
  this.totalScore = this.results.reduce((sum, r) => sum + (r.finalScore || 0), 0);
  this.averageConfidence = this.results.length > 0
    ? this.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / this.results.length
    : 0;
};

// Ensure virtuals are included in JSON
EvaluationSchema.set('toJSON', { virtuals: true });
EvaluationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
