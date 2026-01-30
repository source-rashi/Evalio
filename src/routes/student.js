const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Student = require('../models/Student');
const Evaluation = require('../models/Evaluation');
const auth = require('../middleware/auth');
const ROLES = require('../constants/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'evalio_secret_key_2025';

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { ok: false, error: 'Too many requests, please try again later' },
});

// Student Registration
router.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    }

    try {
      const { name, email, password } = req.body;
      
      // Check if student already exists
      const existingStudent = await Student.findOne({ email });
      if (existingStudent) {
        return res.status(400).json({ ok: false, error: 'Email already registered' });
      }

      // Create new student
      const student = new Student({ name, email, password });
      await student.save();

      res.json({ ok: true, message: 'Student registered successfully' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// Student Login
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    }

    try {
      const { email, password } = req.body;

      // Find student
      const student = await Student.findOne({ email });
      if (!student) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }

      // Compare password
      const isMatch = await student.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }

      // Generate JWT with role
      const token = jwt.sign(
        { id: student._id, email: student.email, role: ROLES.STUDENT },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        ok: true,
        token,
        student: { id: student._id, name: student.name, email: student.email },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// Get student profile (auth-protected)
router.get('/me', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      return res.status(404).json({ ok: false, error: 'Student not found' });
    }
    res.json({ ok: true, student });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get student results
router.get('/results/:id', async (req, res) => {
  try {
    const evals = await Evaluation.find({ submission_id: req.params.id });
    res.json({ ok: true, evaluations: evals });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
