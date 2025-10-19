const vision = require('@google-cloud/vision');

// Uses GOOGLE_APPLICATION_CREDENTIALS for auth
const client = new vision.ImageAnnotatorClient();

async function extractTextFromImage(imageUri) {
  // imageUri can be a public URL (e.g., Cloudinary secure_url)
  const [result] = await client.textDetection(imageUri);
  const detections = result.textAnnotations || [];
  const fullText = detections[0]?.description || '';
  return fullText.trim();
}

module.exports = { extractTextFromImage };
