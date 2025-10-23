const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const { gradeAnswer } = require('../services/grading');
const { evalLimiter } = require('../middleware/rateLimit');
const { param, validationResult } = require('express-validator');

// Get evaluation for a submission
router.get('/:submissionId', param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
    const evaluation = await Evaluation.findOne({ submission_id: req.params.submissionId });
    if (!evaluation) {
      return res.json({ ok: true, evaluation: null }); // No evaluation yet
    }
    
    // Format evaluation with question scores
    const questionScores = evaluation.results?.map(r => ({
      questionId: r.questionId,
      score: r.score,
      maxScore: 5, // You might want to fetch actual max from question
      feedback: r.feedback
    })) || [];
    
    res.json({ 
      ok: true, 
      evaluation: {
        totalScore: evaluation.totalScore,
        maxScore: questionScores.reduce((sum, q) => sum + q.maxScore, 0),
        questionScores
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Evaluate a submission by id (placeholder - integrate AI here)
router.post('/:submissionId', evalLimiter, param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
  const submission = await Submission.findById(req.params.submissionId).populate('answers.questionId');
    if (!submission) return res.status(404).json({ ok: false, error: 'Not found' });
  if (submission.status === 'draft') return res.status(400).json({ ok: false, error: 'Finalize submission before evaluation' });

    const qIds = submission.answers.map(a => a.questionId?._id).filter(Boolean);
    const qDocs = await Question.find({ _id: { $in: qIds } });
    const qMap = new Map(qDocs.map(q => [String(q._id), q]));

    const results = [];
    for (const a of submission.answers) {
      const q = qMap.get(String(a.questionId?._id || a.questionId));
      const max = Math.min(5, q?.marks ?? 5);
      const model = q?.modelAnswer || '';
      const keypoints = q?.keypoints || [];
      const student = a.extractedText || '';
      const r = await gradeAnswer({ modelAnswer: model, studentAnswer: student, maxScore: max, keypoints });
      results.push({ questionId: a.questionId, score: r.score, feedback: r.feedback });
    }
    const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
    const evalDoc = new Evaluation({ submission_id: submission._id, results, totalScore });
    await evalDoc.save();
    res.json({ ok: true, evaluation: evalDoc });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
