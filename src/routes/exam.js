const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');

router.post('/create', async (req, res) => {
  try {
    const exam = new Exam(req.body);
    await exam.save();
    res.json({ ok: true, exam });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post('/question/add', async (req, res) => {
  try {
    const q = new Question(req.body);
    await q.save();
    // attach to exam if provided
    if (req.body.exam_id) {
      await Exam.findByIdAndUpdate(req.body.exam_id, { $push: { questions: q._id } });
    }
    res.json({ ok: true, question: q });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
