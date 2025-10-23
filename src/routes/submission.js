const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const { body, param, validationResult } = require('express-validator');

// Get submission details by ID
router.get('/:submissionId', param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate('student_id', 'name email')
      .populate('exam_id', 'title subject');
    
    if (!submission) return res.status(404).json({ ok: false, error: 'Submission not found' });
    
    res.json({ ok: true, submission });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Upload a submission (images should be uploaded to Cloudinary from client)
router.post('/upload',
  body('exam_id').isMongoId().withMessage('Valid exam_id required'),
  body('answers').isArray({ min: 1 }).withMessage('answers array required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    try {
      const s = new Submission(req.body);
      await s.save();
      res.json({ ok: true, submission: s });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;
