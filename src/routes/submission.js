const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const { body, validationResult } = require('express-validator');

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
