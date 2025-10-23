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
function buildCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === '' || raw.trim() === '*') {
    // true allows any origin (no credentials)
    return true;
  }
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 1 && list[0] === '*') return true;
  return list;
}
app.use(cors({ origin: buildCorsOrigin() }));
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
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = mongoose.connection.readyState;
  res.json({ ok: true, status: 'healthy', db: dbStates[state] || state });
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
app.use('/api/migration', require('./src/routes/migration'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
