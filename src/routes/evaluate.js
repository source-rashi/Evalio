const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const { scoreAnswer } = require('../utils/scoring');

// Evaluate a submission by id (placeholder - integrate AI here)
router.post('/:submissionId', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId).populate('answers.questionId');
    if (!submission) return res.status(404).json({ ok: false, error: 'Not found' });

    const qIds = submission.answers.map(a => a.questionId?._id).filter(Boolean);
    const qDocs = await Question.find({ _id: { $in: qIds } });
    const qMap = new Map(qDocs.map(q => [String(q._id), q]));

    const results = submission.answers.map(a => {
      const q = qMap.get(String(a.questionId?._id || a.questionId));
      const max = q?.marks ?? 5;
      const model = q?.modelAnswer || '';
      const student = a.extractedText || '';
      const r = scoreAnswer(model, student, Math.min(5, max));
      return { questionId: a.questionId, score: r.score, feedback: r.feedback };
    });
    const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
    const evalDoc = new Evaluation({ submission_id: submission._id, results, totalScore });
    await evalDoc.save();
    res.json({ ok: true, evaluation: evalDoc });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
