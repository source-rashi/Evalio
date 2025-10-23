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
    
    let query = { status: { $in: ['finalized', 'evaluated'] } };
    
    if (examId) {
      // If examId provided, verify teacher owns it and filter by it
      const exam = await Exam.findById(examId);
      if (!exam || String(exam.teacher_id) !== String(req.user.id)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      query.exam_id = examId;
    } else {
      // If no examId, fetch all exams by this teacher and filter submissions
      const teacherExams = await Exam.find({ teacher_id: req.user.id }).select('_id');
      const examIds = teacherExams.map(e => e._id);
      query.exam_id = { $in: examIds };
    }
    
    // Only show finalized or evaluated submissions (not drafts)
    const subs = await Submission.find(query)
      .populate('student_id', 'name email')
      .populate('exam_id', 'title subject')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${subs.length} submissions ${examId ? `for exam ${examId}` : 'for all exams'} with status finalized/evaluated`);
    
    const evals = await Evaluation.find({ submission_id: { $in: subs.map(s => s._id) } });
    const evalMap = new Map(evals.map(e => [String(e.submission_id), e]));
    const data = subs.map(s => ({
      id: s._id,
      status: s.status,
      answersCount: s.answers.length,
      createdAt: s.createdAt,
      studentName: s.student_id?.name || 'Anonymous',
      studentEmail: s.student_id?.email || '',
      examTitle: s.exam_id?.title || 'Unknown Exam',
      examSubject: s.exam_id?.subject || '',
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
