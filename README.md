# Evalio

Smart Exam Evaluation System powered by AI Vision and NLP.

Overview
--------
Evalio automates grading of subjective answers using OCR and NLP. This repository contains a minimal scaffold for a full-stack app with a Node/Express backend and a React frontend.

Quick setup (development)
-------------------------
1. Install dependencies for backend:

   npm install

2. Create a `.env` file with the following variables:

   MONGO_URI=
   OPENAI_KEY=
   CLOUDINARY_URL=
   GOOGLE_APPLICATION_CREDENTIALS=
   JWT_SECRET=

3. Start the backend (from repo root):

   npm run dev

4. Frontend is in `frontend/` — see its README for steps.

What I scaffolded
------------------
- Basic Express server with Mongoose models for Teacher, Student, Exam, Question, Submission, Evaluation.
- Authentication stubs (JWT).
- API endpoints described in the project spec.
- Minimal React app (create-react-app style) under `frontend/`.

Next steps
----------
- Add AI integrations (OpenAI/Google Vision) keys and implement OCR / grading controllers.
- Add tests, CI, and deployment workflows.
