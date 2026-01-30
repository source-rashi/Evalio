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

// Get evaluation for a submission
router.get('/:submissionId', param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
    const evaluation = await Evaluation.findOne({ submission_id: req.params.submissionId });
    if (!evaluation) {
      return res.json({ ok: true, evaluation: null }); // No evaluation yet
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
        createdAt: evaluation.createdAt
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Evaluate a submission by id (placeholder - integrate AI here)
router.post('/:submissionId', auth, requireRole(ROLES.TEACHER), evalLimiter, param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
  const submission = await Submission.findById(req.params.submissionId).populate('answers.questionId');
    if (!submission) return res.status(404).json({ ok: false, error: 'Not found' });
  if (submission.status === SUBMISSION_STATUS.DRAFT) return res.status(400).json({ ok: false, error: 'Finalize submission before evaluation' });

    const qIds = submission.answers.map(a => a.questionId?._id).filter(Boolean);
    const qDocs = await Question.find({ _id: { $in: qIds } });
    const qMap = new Map(qDocs.map(q => [String(q._id), q]));

    const results = [];
    let maxScore = 0;
    
    for (const a of submission.answers) {
      const q = qMap.get(String(a.questionId?._id || a.questionId));
      if (!q) {
        console.warn(`Question not found for answer: ${a.questionId}`);
        continue;
      }
      
      const questionMaxScore = q.marks || 5;
      maxScore += questionMaxScore;
      
      const model = q.modelAnswer || '';
      const keypoints = q.keypoints || [];
      const student = a.extractedText || '';
      
      console.log(`Grading question ${q._id}: max=${questionMaxScore}, model length=${model.length}, student length=${student.length}`);
      
      const r = await gradeAnswer({ 
        modelAnswer: model, 
        studentAnswer: student, 
        maxScore: questionMaxScore, 
        keypoints 
      });
      
      // Map to new schema: aiScore and finalScore
      results.push({ 
        questionId: a.questionId,
        aiScore: r.score || 0,
        finalScore: r.score || 0,  // Initially same as AI score
        maxScore: questionMaxScore,
        aiFeedback: r.feedback || '',
        feedback: r.feedback || '',
        confidence: r.confidence || 0.5,  // Default confidence
        isOverridden: false
      });
    }
    
    const aiTotalScore = results.reduce((sum, r) => sum + (r.aiScore || 0), 0);
    const totalScore = results.reduce((sum, r) => sum + (r.finalScore || 0), 0);
    
    console.log(`Evaluation complete: ${totalScore}/${maxScore} (${results.length} questions)`);
    
    // Create evaluation with new schema
    // Status: PENDING → AI_EVALUATED (first lifecycle transition)
    const evalDoc = new Evaluation({ 
      submission_id: submission._id, 
      results,
      aiTotalScore,
      totalScore,
      status: EVALUATION_STATUS.AI_EVALUATED,  // Lifecycle: AI has completed scoring
      averageConfidence: results.length > 0 
        ? results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length 
        : 0
    });
    
    // Calculate totals using model method
    evalDoc.calculateTotals();
    await evalDoc.save();
    
    // Update submission status to 'evaluated'
    submission.status = SUBMISSION_STATUS.EVALUATED;
    await submission.save();
    
    console.log(`✓ Submission ${submission._id} evaluated. Total score: ${totalScore}/${maxScore}`);
    
    res.json({ 
      ok: true, 
      evaluation: {
        _id: evalDoc._id,
        submission_id: evalDoc.submission_id,
        totalScore: evalDoc.totalScore,
        aiTotalScore: evalDoc.aiTotalScore,
        maxScore,
        status: evalDoc.status,
        averageConfidence: evalDoc.averageConfidence,
        results: evalDoc.results,
        createdAt: evalDoc.createdAt
      }
    });
  } catch (err) {
    console.error('❌ Evaluation POST error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
