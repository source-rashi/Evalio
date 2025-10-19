const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimit');
const Teacher = require('../models/Teacher');

// Register (simplified)
router.post('/register', authLimiter,
  body('name').isLength({ min: 2 }).withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    const { name, email, password } = req.body;
    try {
      const exists = await Teacher.findOne({ email });
      if (exists) return res.status(400).json({ ok: false, error: 'Email already registered' });
      const t = new Teacher({ name, email, password });
      await t.save();
      res.json({ ok: true, teacher: { id: t._id, name: t.name, email: t.email } });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

// Login
router.post('/login', authLimiter,
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    const { email, password } = req.body;
    try {
      const t = await Teacher.findOne({ email });
      if (!t) return res.status(400).json({ ok: false, error: 'Invalid credentials' });
      const match = await t.comparePassword(password);
      if (!match) return res.status(400).json({ ok: false, error: 'Invalid credentials' });
      const token = jwt.sign({ id: t._id, email: t.email }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
      res.json({ ok: true, token, teacher: { id: t._id, name: t.name, email: t.email } });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;
