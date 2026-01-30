const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const auth = require('../middleware/auth');
const ROLES = require('../constants/roles');

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
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ ok: false, error: 'Email already registered' });
      const user = new User({ name, email, password, role: ROLES.TEACHER });
      await user.save();
      res.json({ ok: true, teacher: { id: user._id, name: user.name, email: user.email } });
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
      const user = await User.findOne({ email, role: ROLES.TEACHER });
      if (!user) return res.status(400).json({ ok: false, error: 'Invalid credentials' });
      const match = await user.comparePassword(password);
      if (!match) return res.status(400).json({ ok: false, error: 'Invalid credentials' });
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'devsecret',
        { expiresIn: '7d' }
      );
      res.json({ ok: true, token, teacher: { id: user._id, name: user.name, email: user.email } });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;

// Get current teacher profile (auth required)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user.userId).select('name email role createdAt');
    if (!user || user.role !== ROLES.TEACHER) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, teacher: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
