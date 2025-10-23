const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Extract text from an image URL using Gemini's vision capabilities
 * @param {string} imageUrl - Public URL of the image (e.g., Cloudinary URL)
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromImageWithGemini(imageUrl) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  try {
    // Use the model specified in environment variables or default to gemini-1.5-flash
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Extract all text from this image. Return ONLY the text content, nothing else. If there are mathematical expressions, preserve them exactly as written. If the text is handwritten, do your best to read it accurately.`;

    // Fetch the image as base64
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // Generate content with image
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);

    const extractedText = result.response.text().trim();
    
    console.log('✓ Gemini OCR extracted text length:', extractedText.length);
    
    return extractedText;
  } catch (error) {
    console.error('Gemini OCR extraction failed:', error.message);
    throw new Error(`Failed to extract text using Gemini: ${error.message}`);
  }
}

module.exports = { extractTextFromImageWithGemini };
