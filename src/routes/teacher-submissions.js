const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Student = require('../models/Student');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');
const ROLES = require('../constants/roles');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { clerkClient } = require('@clerk/express');

// GET /api/teacher/submissions?examId=...&page=1&limit=20
router.get('/submissions', auth, requireRole(ROLES.TEACHER), async (req, res) => {
  try {
    const { examId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    
    console.log('Fetching submissions for teacher:', req.user.id, 'examId:', examId);
    
    let query = { status: { $in: [SUBMISSION_STATUS.FINALIZED, SUBMISSION_STATUS.EVALUATED] } };
    
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
    
    console.log('Submission query:', JSON.stringify(query));
    
    // Only show finalized or evaluated submissions (not drafts)
    const [subs, total] = await Promise.all([
      Submission.find(query)
        .select('student_id exam_id status createdAt')
        .populate('exam_id', 'title subject')  // Only populate exam, not student (Clerk ID)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Submission.countDocuments(query)
    ]);
    
    console.log(`Found ${subs.length} submissions ${examId ? `for exam ${examId}` : 'for all exams'} with status finalized/evaluated`);
    
    // Fetch evaluations
    const evals = await Evaluation.find({ submission_id: { $in: subs.map(s => s._id) } })
      .select('submission_id totalScore aiTotalScore status');
    const evalMap = new Map(evals.map(e => [String(e.submission_id), e]));
    
    // Fetch student info from Clerk
    const studentIds = [...new Set(subs.map(s => s.student_id).filter(Boolean))];
    const studentMap = new Map();
    
    for (const studentId of studentIds) {
      try {
        const clerkUser = await clerkClient.users.getUser(studentId);
        studentMap.set(studentId, {
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Student',
          email: clerkUser.emailAddresses?.[0]?.emailAddress || 'No email'
        });
      } catch (clerkError) {
        console.error(`Failed to fetch student ${studentId} from Clerk:`, clerkError.message);
        studentMap.set(studentId, { name: 'Student', email: '' });
      }
    }
    
    const data = subs.map(s => {
      const studentInfo = studentMap.get(s.student_id) || { name: 'Anonymous', email: '' };
      return {
        id: s._id,
        status: s.status,
        createdAt: s.createdAt,
        studentId: s.student_id,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        examTitle: s.exam_id?.title || 'Unknown Exam',
        examSubject: s.exam_id?.subject || '',
        totalScore: evalMap.get(String(s._id))?.totalScore ?? null,
        aiTotalScore: evalMap.get(String(s._id))?.aiTotalScore ?? null,
        evaluationStatus: evalMap.get(String(s._id))?.status ?? null,
      };
    });
    
    const response = buildPaginationResponse(data, total, page, limit);
    res.json({ ok: true, submissions: response.items, pagination: response.pagination });
  } catch (err) {
    console.error('Error in /api/teacher/submissions:', err.message, err.stack);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/teacher/students - Get all students for assignment
router.get('/students', auth, requireRole(ROLES.TEACHER), async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    
    const [students, total] = await Promise.all([
      Student.find({}).select('_id name email').sort({ name: 1 }).skip(skip).limit(limit),
      Student.countDocuments({})
    ]);
    
    const response = buildPaginationResponse(students, total, page, limit);
    res.json({ ok: true, students: response.items, pagination: response.pagination });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
