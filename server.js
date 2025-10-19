const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
// Security headers
app.use(helmet());
// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*'}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/evalio', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected')).catch(err => console.error('MongoDB error', err));

app.get('/', (req, res) => {
  res.json({ ok: true, name: 'Evalio API' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// Route placeholders
app.use('/api/teacher', require('./src/routes/teacher'));
app.use('/api/exam', require('./src/routes/exam'));
app.use('/api/submission', require('./src/routes/submission'));
app.use('/api/evaluate', require('./src/routes/evaluate'));
app.use('/api/student', require('./src/routes/student'));
app.use('/api/ocr', require('./src/routes/ocr'));
app.use('/api/draft', require('./src/routes/draft'));
app.use('/api/teacher', require('./src/routes/teacher-submissions'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
