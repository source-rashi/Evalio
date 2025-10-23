const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Student = require('../models/Student');

// GET /api/teacher/submissions?examId=...
router.get('/submissions', auth, async (req, res) => {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ ok: false, error: 'examId required' });
    const exam = await Exam.findById(examId);
    if (!exam || String(exam.teacher_id) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    // Only show finalized or evaluated submissions (not drafts)
    const subs = await Submission.find({ 
      exam_id: examId,
      status: { $in: ['finalized', 'evaluated'] }
    })
      .populate('student_id', 'name email')
      .sort({ createdAt: -1 });
    const evals = await Evaluation.find({ submission_id: { $in: subs.map(s => s._id) } });
    const evalMap = new Map(evals.map(e => [String(e.submission_id), e]));
    const data = subs.map(s => ({
      id: s._id,
      status: s.status,
      answersCount: s.answers.length,
      createdAt: s.createdAt,
      studentName: s.student_id?.name || 'Anonymous',
      studentEmail: s.student_id?.email || '',
      totalScore: evalMap.get(String(s._id))?.totalScore ?? null,
      maxScore: evalMap.get(String(s._id))?.maxScore ?? null,
    }));
    res.json({ ok: true, submissions: data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/teacher/students - Get all students for assignment
router.get('/students', auth, async (req, res) => {
  try {
    const students = await Student.find({}).select('_id name email').sort({ name: 1 });
    res.json({ ok: true, students });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
