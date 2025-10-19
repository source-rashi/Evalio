const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');

// Evaluate a submission by id (placeholder - integrate AI here)
router.post('/:submissionId', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId).populate('answers.questionId');
    if (!submission) return res.status(404).json({ ok: false, error: 'Not found' });

    // Placeholder: simple rule-based scoring (needs AI integration)
    const results = submission.answers.map(a => ({ questionId: a.questionId, score: 0, feedback: 'Not graded yet' }));
    const evalDoc = new Evaluation({ submission_id: submission._id, results, totalScore: 0 });
    await evalDoc.save();
    res.json({ ok: true, evaluation: evalDoc });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
