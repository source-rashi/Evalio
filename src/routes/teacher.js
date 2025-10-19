const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

// Register (simplified)
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const t = new Teacher({ name, email, password });
    await t.save();
    res.json({ ok: true, teacher: t });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
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
});

module.exports = router;
