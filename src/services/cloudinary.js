const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
dotenv.config();

// Cloudinary uses the CLOUDINARY_URL env var automatically
// Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (!process.env.CLOUDINARY_URL) {
  console.error('⚠️  CLOUDINARY_URL environment variable is not set');
} else if (process.env.CLOUDINARY_URL.includes('<your_api_secret>')) {
  console.error('⚠️  CLOUDINARY_URL contains placeholder. Please replace with actual credentials from Cloudinary dashboard.');
} else {
  console.log('✓ Cloudinary configured');
}

cloudinary.config({
  secure: true,
});

async function uploadBuffer(buffer, folder = 'evalio') {
  if (!process.env.CLOUDINARY_URL || process.env.CLOUDINARY_URL.includes('<your_api_secret>')) {
    throw new Error('Cloudinary is not properly configured. Check CLOUDINARY_URL in .env file.');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, res) => {
      if (err) {
        console.error('Cloudinary upload error:', err.message);
        return reject(err);
      }
      console.log('✓ Uploaded to Cloudinary:', res.secure_url);
      resolve(res);
    });
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
