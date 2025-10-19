const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer();
const { ocrLimiter } = require('../middleware/rateLimit');
const { uploadBuffer } = require('../services/cloudinary');
const { extractTextFromImage } = require('../services/ocr');

// POST /api/ocr/extract  (multipart/form-data: file)
router.post('/extract', ocrLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const uploaded = await uploadBuffer(req.file.buffer, 'evalio_submissions');
    const text = await extractTextFromImage(uploaded.secure_url);
    res.json({ ok: true, text, imageUrl: uploaded.secure_url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
