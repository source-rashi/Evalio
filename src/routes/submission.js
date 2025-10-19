const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');

// Upload a submission (images should be uploaded to Cloudinary from client)
router.post('/upload', async (req, res) => {
  try {
    const s = new Submission(req.body);
    await s.save();
    res.json({ ok: true, submission: s });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
