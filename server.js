const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');
const correlationIdMiddleware = require('./src/middleware/correlationId');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

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

// Correlation ID middleware - must be before routes
app.use(correlationIdMiddleware);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/evalio', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => logger.info('MongoDB connected')).catch(err => logger.error({ err }, 'MongoDB connection error'));

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
app.use('/api/evaluation', require('./src/routes/override'));
app.use('/api/student', require('./src/routes/student'));
app.use('/api/ocr', require('./src/routes/ocr'));
app.use('/api/draft', require('./src/routes/draft'));
app.use('/api/teacher', require('./src/routes/teacher-submissions'));
app.use('/api/migration', require('./src/routes/migration'));

// Error handling middleware - MUST be last
app.use(notFoundHandler);  // 404 handler for undefined routes
app.use(errorHandler);     // Centralized error handler

app.listen(PORT, () => logger.info('Server started', { port: PORT }));
