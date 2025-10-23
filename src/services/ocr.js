// Legacy OCR service - now redirects to Gemini OCR
// This file is kept for backward compatibility but no longer uses Google Cloud Vision

const { extractTextFromImageWithGemini } = require('./gemini-ocr');

/**
 * @deprecated Use gemini-ocr.js instead
 * This function now redirects to Gemini OCR for backward compatibility
 */
async function extractTextFromImage(imageUri) {
  console.log('⚠️  Using legacy OCR function - redirecting to Gemini OCR');
  return await extractTextFromImageWithGemini(imageUri);
}

module.exports = { extractTextFromImage };
