const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');
const correlationIdMiddleware = require('./src/middleware/correlationId');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { validateEnvironment } = require('./src/utils/validateEnv');

dotenv.config();

// Validate environment variables on startup (fails fast if misconfigured)
validateEnvironment();

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

// Health check endpoints (for deployment orchestration, load balancers, monitoring)
// GET /health - Liveness probe (is the server running?)
app.get('/health', (req, res) => {
  // Simple liveness check - if this responds, the server is alive
  res.status(200).json({ status: 'ok' });
});

// GET /ready - Readiness probe (is the server ready to handle traffic?)
app.get('/ready', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    queue: 'unknown'
  };

  // Check MongoDB connection
  const dbState = mongoose.connection.readyState;
  checks.database = dbState === 1 ? 'ok' : 'unavailable';

  // Check Redis/Queue connection (non-blocking check)
  try {
    const evaluationQueue = require('./src/queues/evaluationQueue');
    const queueClient = evaluationQueue.client;
    
    if (queueClient && queueClient.status === 'ready') {
      checks.queue = 'ok';
    } else if (queueClient && queueClient.status === 'connecting') {
      checks.queue = 'connecting';
    } else {
      checks.queue = 'unavailable';
    }
  } catch (error) {
    checks.queue = 'unavailable';
  }

  // Server is ready only if database is connected
  // Queue is optional (system can work in degraded mode without async processing)
  const isReady = checks.database === 'ok';
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    checks
  });
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
app.use('/api/queue', require('./src/routes/queue')); // Queue monitoring

// Error handling middleware - MUST be last
app.use(notFoundHandler);  // 404 handler for undefined routes
app.use(errorHandler);     // Centralized error handler

// Export app for testing before calling listen
module.exports = app;

// Only listen if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => logger.info('Server started', { port: PORT }));
}
