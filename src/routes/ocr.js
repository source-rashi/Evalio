const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer();
const { ocrLimiter } = require('../middleware/rateLimit');
const { uploadBuffer } = require('../services/cloudinary');
const { extractTextFromImageWithGemini } = require('../services/gemini-ocr');

// POST /api/ocr/extract  (multipart/form-data: file)
router.post('/extract', ocrLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    
    // Upload to Cloudinary
    let imageUrl;
    try {
      const uploaded = await uploadBuffer(req.file.buffer, 'evalio_submissions');
      imageUrl = uploaded.secure_url;
      console.log('✓ Image uploaded to Cloudinary:', imageUrl);
    } catch (uploadErr) {
      console.error('❌ Cloudinary upload error:', uploadErr.message);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to upload image. Check CLOUDINARY_URL in .env file.' 
      });
    }
    
    // Extract text using Gemini Vision API
    let text = '';
    try {
      text = await extractTextFromImageWithGemini(imageUrl);
      console.log('✓ Gemini extracted text length:', text.length);
    } catch (ocrErr) {
      console.error('❌ OCR extraction error:', ocrErr.message);
      // Still return success with imageUrl but empty text
      return res.json({ 
        ok: true, 
        text: '', 
        imageUrl,
        warning: 'Image uploaded but text extraction failed. Check GEMINI_API_KEY in .env file.' 
      });
    }
    
    res.json({ ok: true, text, imageUrl });
  } catch (err) {
    console.error('❌ OCR route error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
