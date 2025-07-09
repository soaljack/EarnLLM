const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Injects a unique traceId into the request object and the logger's context.
 * This allows us to trace a request through the entire system.
 */
const requestTracer = (req, res, next) => {
  const traceId = req.headers['x-request-id'] || uuidv4();
  req.traceId = traceId;

  // Create a child logger with the traceId, so all subsequent logs will have it
  req.logger = logger.child({ traceId });

  next();
};

module.exports = requestTracer;
