const vision = require('@google-cloud/vision');

// Uses GOOGLE_APPLICATION_CREDENTIALS for auth
const client = new vision.ImageAnnotatorClient();

function getLanguageHints() {
  const hints = (process.env.OCR_LANGUAGE_HINTS || '').split(',').map(s => s.trim()).filter(Boolean);
  return hints.length ? hints : undefined;
}

async function extractTextFromImage(imageUri) {
  // imageUri can be a public URL (e.g., Cloudinary secure_url)
  const imageContext = { languageHints: getLanguageHints() };
  try {
    const [result] = await client.documentTextDetection({ image: { source: { imageUri } }, imageContext });
    const fullText = result.fullTextAnnotation?.text || '';
    if (fullText && fullText.trim()) return fullText.trim();
  } catch {
    // fallback below
  }
  // Fallback to simple textDetection
  const [fallback] = await client.textDetection(imageUri);
  const detections = fallback.textAnnotations || [];
  const fullText = detections[0]?.description || '';
  return fullText.trim();
}

module.exports = { extractTextFromImage };
