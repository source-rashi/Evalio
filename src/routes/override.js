const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const ManualOverride = require('../models/ManualOverride');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const ROLES = require('../constants/roles');
const { body, param, validationResult } = require('express-validator');
const { EVALUATION_STATUS } = require('../constants/evaluationStatus');

/**
 * POST /api/evaluation/:evaluationId/override
 * Create a manual override for a specific question in an evaluation
 * Teacher-only endpoint
 */
router.post(
  '/:evaluationId/override',
  auth,
  requireRole(ROLES.TEACHER),
  [
    param('evaluationId').isMongoId().withMessage('Invalid evaluation ID'),
    body('questionId').isMongoId().withMessage('Invalid question ID'),
    body('overriddenScore').isNumeric().withMessage('Overridden score must be a number'),
    body('reason').isString().trim().isLength({ min: 10, max: 1000 })
      .withMessage('Reason must be between 10-1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { evaluationId } = req.params;
    const { questionId, overriddenScore, reason } = req.body;
    const teacherId = req.user.id;

    try {
      // 1. Fetch evaluation
      const evaluation = await Evaluation.findById(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ ok: false, error: 'Evaluation not found' });
      }

      // 2. Check evaluation status - must be AI_EVALUATED or later
      if (evaluation.status === EVALUATION_STATUS.PENDING) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Cannot override: evaluation is still pending AI grading' 
        });
      }

      // 3. Find the question result in evaluation
      const questionResult = evaluation.results.find(
        r => r.questionId.toString() === questionId
      );
      
      if (!questionResult) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Question not found in this evaluation' 
        });
      }

      // 4. Validate overridden score bounds
      const maxScore = questionResult.maxScore || 5;
      if (overriddenScore < 0 || overriddenScore > maxScore) {
        return res.status(400).json({ 
          ok: false, 
          error: `Score must be between 0 and ${maxScore}` 
        });
      }

      // 5. Check if override already exists
      const existingOverride = await ManualOverride.findOne({
        evaluation_id: evaluationId,
        question_id: questionId
      });

      if (existingOverride) {
        return res.status(400).json({
          ok: false,
          error: 'Override already exists for this question',
          existingOverride: {
            overriddenScore: existingOverride.overridden_score,
            reason: existingOverride.reason,
            createdAt: existingOverride.created_at
          }
        });
      }

      // 6. Create manual override document
      const manualOverride = new ManualOverride({
        evaluation_id: evaluationId,
        question_id: questionId,
        teacher_id: teacherId,
        ai_score: questionResult.aiScore || questionResult.score || 0,
        overridden_score: parseFloat(overriddenScore),
        max_score: maxScore,
        reason: reason.trim()
      });

      await manualOverride.save();

      console.log(`✏️ Manual override created: Evaluation ${evaluationId}, Question ${questionId}`);
      console.log(`   Teacher: ${teacherId}`);
      console.log(`   AI Score: ${manualOverride.ai_score} → Override: ${manualOverride.overridden_score}`);

      res.status(201).json({
        ok: true,
        message: 'Manual override created successfully',
        override: {
          id: manualOverride._id,
          evaluationId: manualOverride.evaluation_id,
          questionId: manualOverride.question_id,
          teacherId: manualOverride.teacher_id,
          aiScore: manualOverride.ai_score,
          overriddenScore: manualOverride.overridden_score,
          maxScore: manualOverride.max_score,
          reason: manualOverride.reason,
          createdAt: manualOverride.created_at
        }
      });

    } catch (err) {
      console.error('❌ Override creation error:', err.message);
      
      if (err.code === 11000) {
        return res.status(400).json({
          ok: false,
          error: 'Duplicate override: this question already has an override'
        });
      }
      
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to create manual override',
        details: err.message 
      });
    }
  }
);

module.exports = router;
