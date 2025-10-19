const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');

// GET /api/teacher/submissions?examId=...
router.get('/submissions', auth, async (req, res) => {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ ok: false, error: 'examId required' });
    const exam = await Exam.findById(examId);
    if (!exam || String(exam.teacher_id) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const subs = await Submission.find({ exam_id: examId }).sort({ createdAt: -1 });
    const evals = await Evaluation.find({ submission_id: { $in: subs.map(s => s._id) } });
    const evalMap = new Map(evals.map(e => [String(e.submission_id), e]));
    const data = subs.map(s => ({
      id: s._id,
      status: s.status,
      answersCount: s.answers.length,
      createdAt: s.createdAt,
      totalScore: evalMap.get(String(s._id))?.totalScore ?? null,
    }));
    res.json({ ok: true, submissions: data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
