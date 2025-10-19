# Deployment guide

Backend (Render/Railway)
------------------------
1. Create a new Web Service from your GitHub repo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables from `.env.example`.

Frontend (Vercel)
-----------------
1. Import the `frontend/` directory as a project.
2. Framework Preset: Create React App.
3. Build command: `npm run build`
4. Output directory: `build`

Database (MongoDB Atlas)
------------------------
1. Create a cluster and a database user.
2. Whitelist IPs or use 0.0.0.0/0 for testing.
3. Use the connection string as `MONGO_URI`.

Cloudinary
----------
1. Create a Cloudinary account.
2. Use the provided `CLOUDINARY_URL` value in env.

Google Vision / Gemini
----------------------
1. Create a GCP project and service account with Vision API.
2. Download JSON key as `gcp-service-account.json` and set `GOOGLE_APPLICATION_CREDENTIALS`.

OpenAI / Gemini NLP
-------------------
1. Add `OPENAI_KEY` or Gemini API key.
2. Implement in `src/routes/evaluate.js` by calling the model and returning JSON { score, feedback } per answer.
