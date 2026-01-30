const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const { extractTextFromImageWithGemini } = require('../services/gemini-ocr');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const ROLES = require('../constants/roles');

// POST /api/draft/start { exam_id, student_id (optional) }
router.post('/start', auth, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const { exam_id, student_id } = req.body;
    const doc = new Submission({ 
      exam_id, 
      student_id: student_id || null,
      answers: [], 
      status: SUBMISSION_STATUS.DRAFT 
    });
    await doc.save();
    res.json({ ok: true, submission: doc });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// PUT /api/draft/:id/answer { questionId, extractedText, answerImage }
router.put('/:id/answer', auth, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const { questionId, extractedText, answerImage } = req.body;
    const s = await Submission.findById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'Draft not found' });
    if (s.status !== SUBMISSION_STATUS.DRAFT) return res.status(400).json({ ok: false, error: 'Submission not in draft state' });
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
router.post('/:id/finalize', auth, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const s = await Submission.findById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'Draft not found' });
    if (s.status !== SUBMISSION_STATUS.DRAFT) return res.status(400).json({ ok: false, error: 'Already finalized' });
    // Auto-OCR for any answers with image but missing text
    for (const ans of s.answers) {
      if ((!ans.extractedText || !ans.extractedText.trim()) && ans.answerImage) {
        try {
          const text = await extractTextFromImageWithGemini(ans.answerImage);
          ans.extractedText = text;
        } catch {
          // ignore OCR errors and continue
        }
      }
    }
    s.status = SUBMISSION_STATUS.FINALIZED;
    await s.save();
    console.log(`✓ Submission ${s._id} finalized for exam ${s.exam_id}, student: ${s.student_id || 'anonymous'}`);
    res.json({ ok: true, submission: s });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
