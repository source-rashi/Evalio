/**
 * Correlation ID Middleware
 * 
 * Generates or extracts a unique correlation ID for each request.
 * This ID is used to trace requests through the entire system:
 * - API request → Background job → Worker processing → Database updates
 * 
 * Why correlation IDs?
 * - Track async operations across multiple services
 * - Link distributed log entries to a single user action
 * - Debug production issues by following request flow
 * - Essential for microservices and job queues
 * 
 * Flow:
 * 1. Client sends request (optionally with X-Correlation-ID header)
 * 2. Middleware generates ID if not provided
 * 3. ID attached to req.correlationId
 * 4. ID passed to background jobs
 * 5. All logs include correlationId field
 * 6. ID returned in response headers
 */

const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

/**
 * Correlation ID middleware
 * 
 * Extracts or generates a correlation ID for request tracing.
 * 
 * Headers:
 * - X-Correlation-ID (input): Client-provided correlation ID
 * - X-Correlation-ID (output): Server correlation ID (echoed back)
 * 
 * Request augmentation:
 * - req.correlationId: Unique ID for this request
 * - req.logger: Child logger with correlationId context
 * 
 * Usage:
 *   app.use(correlationIdMiddleware);
 *   
 *   // In route handlers:
 *   req.logger.info('Processing request', { userId });
 *   await queue.add({ correlationId: req.correlationId, ...data });
 */
function correlationIdMiddleware(req, res, next) {
  // Extract or generate correlation ID
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  
  // Attach to request object
  req.correlationId = correlationId;
  
  // Create child logger with correlationId context
  // All logs from req.logger will automatically include correlationId
  req.logger = logger.createChild({ correlationId });
  
  // Add to response headers for client tracking
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}

module.exports = correlationIdMiddleware;
