const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful responses
  message: 'Too many failed login attempts from this IP, please try again after 15 minutes',
});

module.exports = {
  authLimiter,
};
