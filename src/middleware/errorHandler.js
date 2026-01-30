/**
 * Centralized Error Handling Middleware
 * 
 * Provides consistent error responses and logging across the application.
 * 
 * Why centralized error handling?
 * - Consistent error response format for clients
 * - Proper error logging with context
 * - Security: Hide internal errors from clients
 * - Different handling for operational vs programmer errors
 * - Production-ready error responses
 * 
 * Error Types:
 * - Operational errors: Expected errors (validation, not found, unauthorized)
 * - Programmer errors: Bugs (null reference, type errors)
 * 
 * Usage:
 *   // In routes - throw or pass to next():
 *   throw new ValidationError('Invalid input');
 *   next(new NotFoundError('Resource not found'));
 *   
 *   // In server.js (MUST be last middleware):
 *   app.use(errorHandler);
 */

const logger = require('../utils/logger');

/**
 * Custom error classes for different error types
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, false); // Not operational - programmer error
  }
}

/**
 * Error handler middleware
 * 
 * Catches all errors thrown in routes and middleware.
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request (with correlationId)
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Use request logger if available (includes correlationId)
  const log = req.logger || logger;
  
  // Default to 500 if no status code
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== undefined ? err.isOperational : false;
  
  // Log error with full context
  const errorContext = {
    err,
    statusCode,
    isOperational,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.userId,
    correlationId: req.correlationId
  };
  
  if (statusCode >= 500 || !isOperational) {
    // Server errors and programmer errors - log with full stack
    log.error(errorContext, 'Request error (server)');
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    log.warn(errorContext, 'Request error (client)');
  }
  
  // Build error response
  const errorResponse = {
    ok: false,
    error: isOperational ? err.message : 'Internal server error',
    statusCode
  };
  
  // Include correlation ID for debugging
  if (req.correlationId) {
    errorResponse.correlationId = req.correlationId;
  }
  
  // Include validation details if available
  if (err.details && isOperational) {
    errorResponse.details = err.details;
  }
  
  // In development, include stack trace for debugging
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 * 
 * Catches all requests to undefined routes.
 * MUST be placed after all route definitions.
 */
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Async handler wrapper
 * 
 * Wraps async route handlers to catch promise rejections.
 * Without this, unhandled promise rejections crash the server.
 * 
 * Usage:
 *   router.get('/resource', asyncHandler(async (req, res) => {
 *     const data = await fetchData();
 *     res.json(data);
 *   }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  // Error classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalError
};
