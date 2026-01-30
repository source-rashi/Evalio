const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const { gradeAnswer } = require('../services/grading');
const { evalLimiter } = require('../middleware/rateLimit');
const { param, validationResult } = require('express-validator');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const ROLES = require('../constants/roles');
const evaluationQueue = require('../queues/evaluationQueue');
const { applyOverridesToEvaluation } = require('../services/overrideReconciliation');
const { asyncHandler, ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

// ML Integration Components (not yet used in this route)
// const { evaluateAnswers } = require('../services/mlAdapter');
// const { validateAndSanitize } = require('../validators/mlResultValidator');

// Get evaluation for a submission
router.get('/:submissionId', param('submissionId').isMongoId(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid submissionId', errors.array());
  }
  
  let evaluation = await Evaluation.findOne({ submission_id: req.params.submissionId });
  if (!evaluation) {
    return res.json({ ok: true, evaluation: null }); // No evaluation yet
  }
  
  // Apply any manual overrides to reconcile final scores
  // This ensures finalScore always reflects the latest overrides
  if (evaluation.status !== EVALUATION_STATUS.PENDING) {
    evaluation = await applyOverridesToEvaluation(evaluation._id);
  }
  
  // Calculate maxScore from results
  const questionScores = evaluation.results?.map(r => ({
    questionId: r.questionId,
    score: r.finalScore || r.score || 0,  // Backward compatible
    aiScore: r.aiScore,
    finalScore: r.finalScore,
    maxScore: r.maxScore || 5,
    feedback: r.feedback || r.aiFeedback || '',
    confidence: r.confidence,
    isOverridden: r.isOverridden
  })) || [];
  
  const maxScore = questionScores.reduce((sum, q) => sum + q.maxScore, 0);
  
  res.json({ 
    ok: true, 
    evaluation: {
      _id: evaluation._id,
      totalScore: evaluation.totalScore,
      aiTotalScore: evaluation.aiTotalScore,
      maxScore,
      questionScores,
      status: evaluation.status,
      averageConfidence: evaluation.averageConfidence,
      hasOverrides: evaluation.hasOverrides,
      createdAt: evaluation.createdAt,
      // Job tracking fields
      jobId: evaluation.jobId,
      jobStatus: evaluation.jobStatus,
      jobError: evaluation.jobError,
      queuedAt: evaluation.queuedAt,
      processingStartedAt: evaluation.processingStartedAt,
      evaluatedAt: evaluation.evaluatedAt
    }
  });
}));

// Evaluate a submission by id - ASYNC with background job queue
router.post('/:submissionId', auth, requireRole(ROLES.TEACHER), evalLimiter, param('submissionId').isMongoId(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid submissionId', errors.array());
  }
  
  const submission = await Submission.findById(req.params.submissionId);
  if (!submission) {
    throw new NotFoundError('Submission not found');
  }
  
  if (submission.status === SUBMISSION_STATUS.DRAFT) {
    throw new ValidationError('Finalize submission before evaluation');
  }

  // Check if already being evaluated or completed
  const existingEvaluation = await Evaluation.findOne({ submission_id: req.params.submissionId });
  if (existingEvaluation) {
    if (existingEvaluation.status === EVALUATION_STATUS.AI_EVALUATED || 
        existingEvaluation.status === EVALUATION_STATUS.MANUALLY_REVIEWED ||
        existingEvaluation.status === EVALUATION_STATUS.FINALIZED) {
      throw new ConflictError('Evaluation already completed');
    }
    
    if (existingEvaluation.jobId && existingEvaluation.status === EVALUATION_STATUS.PENDING) {
      throw new ConflictError('Evaluation already in progress');
    }
  }

  // Enqueue evaluation job
  const job = await evaluationQueue.add('evaluate-submission', {
    submissionId: req.params.submissionId,
    examId: submission.exam_id,
    studentId: submission.student_id,
    triggeredBy: req.user.userId, // Teacher who triggered evaluation
    correlationId: req.correlationId // Pass correlation ID to worker
  }, {
    priority: req.body.priority || 5, // Default priority
    jobId: `eval-${req.params.submissionId}-${Date.now()}` // Unique job ID
  });

  req.logger.info({ jobId: job.id, submissionId: req.params.submissionId }, 'Evaluation job enqueued');

  // Create or update Evaluation document with PENDING status
  const evaluation = await Evaluation.findOneAndUpdate(
      { submission_id: req.params.submissionId },
      {
        submission_id: req.params.submissionId,
        status: EVALUATION_STATUS.PENDING,
        jobId: job.id,
        queuedAt: new Date(),
        results: [] // Will be populated by worker
    },
    { upsert: true, new: true }
  );

  // Return immediately - don't wait for processing
  return res.json({
    ok: true,
    message: 'Evaluation job enqueued successfully',
    evaluationId: evaluation._id,
    jobId: job.id,
    status: EVALUATION_STATUS.PENDING,
    note: 'Poll the evaluation endpoint to check progress'
  });
}));

module.exports = router;
