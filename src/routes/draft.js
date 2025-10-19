const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const auth = require('../middleware/auth');

// POST /api/draft/start { exam_id }
router.post('/start', async (req, res) => {
  try {
    const doc = new Submission({ exam_id: req.body.exam_id, answers: [], status: 'draft' });
    await doc.save();
    res.json({ ok: true, submission: doc });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// PUT /api/draft/:id/answer { questionId, extractedText, answerImage }
router.put('/:id/answer', async (req, res) => {
  try {
    const { questionId, extractedText, answerImage } = req.body;
    const s = await Submission.findById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'Draft not found' });
    if (s.status !== 'draft') return res.status(400).json({ ok: false, error: 'Submission not in draft state' });
    const idx = s.answers.findIndex(a => String(a.questionId) === String(questionId));
    if (idx >= 0) {
      if (typeof extractedText === 'string') s.answers[idx].extractedText = extractedText;
      if (typeof answerImage === 'string') s.answers[idx].answerImage = answerImage;
    } else {
      s.answers.push({ questionId, extractedText: extractedText || '', answerImage: answerImage || '' });
    }
    await s.save();
    res.json({ ok: true, submission: s });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/draft/:id/finalize
router.post('/:id/finalize', async (req, res) => {
  try {
    const s = await Submission.findById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'Draft not found' });
    if (s.status !== 'draft') return res.status(400).json({ ok: false, error: 'Already finalized' });
    s.status = 'finalized';
    await s.save();
    res.json({ ok: true, submission: s });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
