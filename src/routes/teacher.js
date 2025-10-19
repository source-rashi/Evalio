const express = require('express');
const router = express.Router();
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

// Login (placeholder)
router.post('/login', (req, res) => {
  res.json({ ok: true, msg: 'login placeholder' });
});

module.exports = router;
