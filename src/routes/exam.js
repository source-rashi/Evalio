const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { body, param, validationResult } = require('express-validator');
const ROLES = require('../constants/roles');

router.post('/create', auth, requireRole(ROLES.TEACHER),
  body('title').isLength({ min: 2 }).withMessage('Title required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    try {
      const payload = { ...req.body, teacher_id: req.user.id };
      const exam = new Exam(payload);
      await exam.save();
      res.json({ ok: true, exam });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

// List exams for current teacher
router.get('/list', auth, requireRole(ROLES.TEACHER), async (req, res) => {
  try {
    const exams = await Exam.find({ teacher_id: req.user.id }).populate('questions');
    res.json({ ok: true, exams });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// List exams for students (assigned or public)
router.get('/student/list', async (req, res) => {
  try {
    const { studentId } = req.query;
    let query = { isPublic: true }; // Default: show public exams
    
    if (studentId) {
      // Show exams assigned to this student OR public exams
      query = {
        $or: [
          { assignedStudents: studentId },
          { isPublic: true }
        ]
      };
    }
    
    const exams = await Exam.find(query).populate('questions');
    res.json({ ok: true, exams });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Assign exam to students
router.post('/:examId/assign', auth, requireRole(ROLES.TEACHER),
  param('examId').isMongoId(),
  body('studentIds').isArray().withMessage('studentIds must be an array'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    
    try {
      const exam = await Exam.findById(req.params.examId);
      if (!exam) return res.status(404).json({ ok: false, error: 'Exam not found' });
      if (String(exam.teacher_id) !== String(req.user.id)) {
        return res.status(403).json({ ok: false, error: 'Not authorized' });
      }
      
      // Add students to assigned list (avoid duplicates)
      const newStudents = req.body.studentIds.filter(sid => !exam.assignedStudents.includes(sid));
      exam.assignedStudents.push(...newStudents);
      await exam.save();
      
      res.json({ ok: true, exam });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

// Toggle exam public/private
router.put('/:examId/toggle-public', auth, requireRole(ROLES.TEACHER), param('examId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid examId' });
  
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ ok: false, error: 'Exam not found' });
    if (String(exam.teacher_id) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'Not authorized' });
    }
    
    exam.isPublic = !exam.isPublic;
    await exam.save();
    
    res.json({ ok: true, exam });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post('/question/add', auth, requireRole(ROLES.TEACHER),
  body('text').isLength({ min: 2 }).withMessage('Question text required'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  body('modelAnswer').isLength({ min: 1 }).withMessage('Model answer required'),
  body('exam_id').isMongoId().withMessage('Valid exam_id required'),
  body('keypoints').optional().isArray().withMessage('keypoints must be an array'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    try {
  const q = new Question({ text: req.body.text, marks: req.body.marks, modelAnswer: req.body.modelAnswer, keypoints: req.body.keypoints || [], exam_id: req.body.exam_id });
      await q.save();
      await Exam.findByIdAndUpdate(req.body.exam_id, { $push: { questions: q._id } });
      res.json({ ok: true, question: q });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

// Get questions for an exam
router.get('/:examId/questions', auth, param('examId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid examId' });
  try {
    const exam = await Exam.findById(req.params.examId).populate('questions');
    if (!exam) return res.status(404).json({ ok: false, error: 'Exam not found' });
    res.json({ ok: true, questions: exam.questions });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
