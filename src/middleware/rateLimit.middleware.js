const { Op } = require('sequelize');
const createError = require('http-errors');
const redis = require('redis');
const { ApiUsage, BillingAccount } = require('../models');

let redisClient = null;

// Function to initialize and connect the Redis client
const connectRateLimiter = async (client = null) => {
  // If an external client is provided, use it.
  if (client) {
    redisClient = client;
    console.log('External Redis client provided for rate limiting.');
    return;
  }
  // Prevent re-connecting if already connected
  if (redisClient && redisClient.isReady) {
    return;
  }

  if (process.env.REDIS_URL) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    try {
      await redisClient.connect();
      console.log('Redis client connected successfully for rate limiting.');
    } catch (err) {
      console.error('Failed to connect to Redis for rate limiting:', err);
      redisClient = null; // Ensure we don't use a failed client
    }
  } else {
    console.warn('No Redis URL provided. Using in-memory rate limiting (not suitable for production).');
  }
};

// In-memory storage for rate limiting when Redis is not available
const inMemoryStore = {
  requests: {},
  cleanup() {
    const now = Date.now();
    Object.keys(this.requests).forEach((key) => {
      // Remove entries older than 1 hour
      this.requests[key] = this.requests[key].filter((timestamp) => now - timestamp < 3600000);
      if (this.requests[key].length === 0) {
        delete this.requests[key];
      }
    });
  },
};

// Run cleanup every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => inMemoryStore.cleanup(), 300000);
}

/**
 * Rate limiting middleware based on pricing plan
 * Enforces requestsPerMinute limit from the user's pricing plan
 */
const rateLimitByPlan = async (req, res, next) => {
  try {
    // Skip rate limiting if no user or API key (should never happen with auth middleware)
    if (!req.user) {
      return next();
    }

    // The user's pricing plan is already loaded by the auth middleware
    const pricingPlan = req.user.PricingPlan;
    if (!pricingPlan) {
      return next(createError(500, 'Pricing plan not found.'));
    }

    // If no rate limit is set for this plan, allow the request
    if (!pricingPlan.requestsPerMinute) {
      return next();
    }

    const userId = req.user.id;
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    let requestCount;

    if (redisClient && redisClient.isReady) {
      // Redis-based rate limiting
      await redisClient.zRemRangeByScore(key, 0, now - windowMs);
      await redisClient.zAdd(key, { score: now, value: now.toString() });
      await redisClient.expire(key, 60); // Expire after 60 seconds
      requestCount = await redisClient.zCard(key);
    } else {
      // In-memory rate limiting
      if (!inMemoryStore.requests[key]) {
        inMemoryStore.requests[key] = [];
      }

      // Remove timestamps outside the current window
      inMemoryStore.requests[key] = inMemoryStore.requests[key].filter(
        (timestamp) => now - timestamp < windowMs,
      );

      // Add current timestamp
      inMemoryStore.requests[key].push(now);
      requestCount = inMemoryStore.requests[key].length;
    }

    // Check if the rate limit has been exceeded
    if (requestCount > pricingPlan.requestsPerMinute) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit of ${pricingPlan.requestsPerMinute} requests per minute exceeded`,
        retryAfter: Math.ceil(windowMs / 1000), // Retry after 1 minute (in seconds)
      });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', pricingPlan.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', pricingPlan.requestsPerMinute - requestCount);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000)); // Unix timestamp

    return next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Pass the error to the global error handler
    return next(error);
  }
};

/**
 * Daily request quota middleware based on pricing plan
 * Enforces requestsPerDay limit from the user's pricing plan
 */
const checkDailyQuota = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // The user's pricing plan is already loaded by the auth middleware
    const pricingPlan = req.user.PricingPlan;
    if (!pricingPlan) {
      return next(createError(500, 'Pricing plan not found.'));
    }

    // If no daily quota is set for this plan, allow the request
    if (!pricingPlan.requestsPerDay) {
      return next();
    }

    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count today's API usage
    const dailyUsageCount = await ApiUsage.count({
      where: {
        UserId: userId,
        createdAt: {
          [Op.gte]: today,
        },
      },
    });

    // Check if daily quota is exceeded
    if (dailyUsageCount >= pricingPlan.requestsPerDay) {
      return res.status(429).json({
        error: 'Quota Exceeded',
        message: `Daily request quota of ${pricingPlan.requestsPerDay} requests exceeded`,
        resetAt: new Date(today.getTime() + 86400000).toISOString(), // Next day
      });
    }

    // Set quota headers
    res.setHeader('X-Daily-Quota-Limit', pricingPlan.requestsPerDay);
    res.setHeader('X-Daily-Quota-Remaining', pricingPlan.requestsPerDay - dailyUsageCount);

    return next();
  } catch (error) {
    console.error('Daily quota check error:', error);
    // Pass the error to the global error handler
    return next(error);
  }
};

/**
 * Check if user has enough token allowance based on their plan
 */
const checkTokenAllowance = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Get user's pricing plan and billing account
    const pricingPlan = req.user.PricingPlan;
    const billingAccount = await BillingAccount.findOne({ where: { UserId: req.user.id } });

    if (!pricingPlan || !billingAccount) {
      return next(createError(500, 'Pricing plan or billing account not found.'));
    }

    // Free tier with unlimited tokens or any unlimited token plan
    if (!pricingPlan.tokenAllowance) {
      return next();
    }

    // Check if token usage exceeds allowance
    if (billingAccount.tokenUsageThisMonth >= pricingPlan.tokenAllowance) {
      // If user is on pay-as-you-go plan with credit balance, allow them to proceed
      if (pricingPlan.code === 'pay-as-you-go' && billingAccount.creditBalance > 0) {
        return next();
      }

      return res.status(402).json({
        error: 'Token Allowance Exceeded',
        message: 'Monthly token allowance exceeded. Please upgrade your plan or add credits.',
        currentUsage: billingAccount.tokenUsageThisMonth,
        allowance: pricingPlan.tokenAllowance,
      });
    }

    return next();
  } catch (error) {
    console.error('Token allowance check error:', error);
    // Pass the error to the global error handler
    return next(error);
  }
};

// Function to gracefully close the Redis client connection
const closeRateLimiter = async () => {
  if (redisClient && redisClient.isReady) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis client disconnected.');
  }
};

/**
 * Creates a generic rate limiter for public endpoints based on IP address.
 * @param {object} options - Options for the rate limiter.
 * @param {number} options.windowMs - The time window in milliseconds.
 * @param {number} options.max - The max number of requests per windowMs.
 * @param {string} options.message - The error message to send when limit is exceeded.
 */
const createPublicRateLimiter = ({ windowMs, max, message }) => async (req, res, next) => {
  try {
    // Use a more specific key for public rate limiting to avoid conflicts
    const key = `ratelimit:public:${req.ip}`;
    const now = Date.now();

    let requestCount;

    if (redisClient && redisClient.isReady) {
      // Redis-based rate limiting using a sorted set
      // Clean up old entries that are outside the time window
      await redisClient.zRemRangeByScore(key, 0, now - windowMs);
      // Add the current request's timestamp
      await redisClient.zAdd(key, { score: now, value: now.toString() });
      // Set an expiration on the key to auto-clean from Redis
      await redisClient.expire(key, Math.ceil(windowMs / 1000));
      // Get the count of requests in the current window
      requestCount = await redisClient.zCard(key);
    } else {
      // In-memory fallback
      if (!inMemoryStore.requests[key]) {
        inMemoryStore.requests[key] = [];
      }
      // Remove timestamps outside the current window
      inMemoryStore.requests[key] = inMemoryStore.requests[key].filter(
        (timestamp) => now - timestamp < windowMs,
      );
      // Add current timestamp
      inMemoryStore.requests[key].push(now);
      requestCount = inMemoryStore.requests[key].length;
    }

    // Set rate limit headers for the client
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - requestCount));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    // If limit is exceeded, send a 429 response
    if (requestCount > max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: message || 'Rate limit exceeded. Please try again later.',
      });
    }

    return next();
  } catch (error) {
    console.error('Public rate limiting error:', error);
    // In case of an error with the rate limiter, allow the request to proceed
    // This prevents the rate limiter from becoming a single point of failure
    return next();
  }
};

module.exports = {
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
  createPublicRateLimiter, // Export the new function
  connectRateLimiter, // Export for setup
  closeRateLimiter, // Export for graceful shutdown in tests
};
