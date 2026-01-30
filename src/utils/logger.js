/**
 * Structured Application Logger
 * 
 * Production-grade logging using Pino for performance and structure.
 * 
 * WHY STRUCTURED LOGGING:
 * - Searchable: Query logs by level, service, requestId, etc.
 * - Machine-readable: JSON format for log aggregation (ELK, Datadog, etc.)
 * - Fast: Pino is one of the fastest Node.js loggers
 * - Context-aware: Attach metadata to every log (environment, service, version)
 * 
 * USAGE:
 * const logger = require('./utils/logger');
 * logger.info('Server started', { port: 5000 });
 * logger.error('Database connection failed', { error: err.message });
 * logger.warn('Rate limit exceeded', { ip: req.ip });
 */

const pino = require('pino');

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create Pino logger instance
const logger = pino({
  // Log level (can be overridden by LOG_LEVEL env var)
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Base context included in all logs
  base: {
    service: 'evalio-backend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  
  // Pretty print in development for readability
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false
    }
  } : undefined,
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Create child logger with additional context
 * Useful for adding request-specific or worker-specific context
 * 
 * @param {Object} bindings - Additional context to include in all logs
 * @returns {Object} Child logger instance
 * 
 * @example
 * const requestLogger = logger.child({ requestId: req.id });
 * requestLogger.info('Processing request');
 */
logger.createChild = function(bindings) {
  return this.child(bindings);
};

/**
 * Log with request context
 * Helper for logging HTTP requests
 * 
 * @param {Object} req - Express request object
 * @param {string} message - Log message
 * @param {Object} extra - Additional metadata
 */
logger.logRequest = function(req, message, extra = {}) {
  this.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    ...extra
  }, message);
};

/**
 * Log error with full context
 * Automatically extracts stack trace and error details
 * 
 * @param {Error} error - Error object
 * @param {string} message - Log message
 * @param {Object} extra - Additional metadata
 */
logger.logError = function(error, message, extra = {}) {
  this.error({
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    ...extra
  }, message);
};

/**
 * Log job processing
 * Helper for logging background job events
 * 
 * @param {Object} job - BullMQ job object
 * @param {string} message - Log message
 * @param {Object} extra - Additional metadata
 */
logger.logJob = function(job, message, extra = {}) {
  this.info({
    jobId: job.id,
    jobName: job.name,
    attemptsMade: job.attemptsMade,
    ...extra
  }, message);
};

module.exports = logger;
