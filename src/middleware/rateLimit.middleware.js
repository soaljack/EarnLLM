const { Op } = require('sequelize');
const createError = require('http-errors');
const Redis = require('ioredis');
const { ApiUsage, BillingAccount } = require('../db/sequelize');

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
  if (redisClient && redisClient.status === 'ready') {
    return;
  }

  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      // Recommended settings for production
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('ready', () => {
      console.log('Redis client connected successfully for rate limiting.');
    });
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
    const { user } = req;
    if (!user) {
      return next();
    }

    const { PricingPlan: pricingPlan } = user;
    if (!pricingPlan) {
      return next(createError(500, 'Pricing plan not found.'));
    }

    // If no rate limit is set for this plan, allow the request
    if (!pricingPlan.requestsPerMinute) {
      return next();
    }

    const userId = user.id;
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    let requestCount;

    if (redisClient && redisClient.status === 'ready') {
      // Use a Redis transaction to ensure atomicity
      const [[, zremrangeResult], [, zaddResult], [, zcardResult], [, expireResult]] = await redisClient
        .multi()
        .zremrangebyscore(key, 0, now - windowMs)
        .zadd(key, now, now.toString())
        .zcard(key)
        .expire(key, 60)
        .exec();
      const count = zcardResult;
      requestCount = count;
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
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000)); // Standard header for 429
      return next(createError(429, `Rate limit of ${pricingPlan.requestsPerMinute} requests per minute exceeded`));
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', pricingPlan.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', pricingPlan.requestsPerMinute - requestCount);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000)); // Unix timestamp

    return next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open: If the rate limiter has an error, allow the request to proceed.
    return next();
  }
};

/**
 * Daily request quota middleware based on pricing plan
 * Enforces requestsPerDay limit from the user's pricing plan
 */
const checkDailyQuota = async (req, res, next) => {
  try {
    const { user } = req;
    if (!user) {
      return next();
    }

    const { PricingPlan: pricingPlan } = user;
    if (!pricingPlan) {
      return next(createError(500, 'Pricing plan not found.'));
    }

    // If no daily quota is set for this plan, allow the request
    if (!pricingPlan.requestsPerDay) {
      return next();
    }

    const userId = user.id;
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
      return next(
        createError(
          429,
          `You have exceeded your daily request quota of ${pricingPlan.requestsPerDay}. 
           Please try again tomorrow.`,
        ),
      );
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
    const { user } = req;
    if (!user) {
      return next();
    }

    // Get user's pricing plan and billing account
    const { PricingPlan: pricingPlan } = user;
    const billingAccount = await BillingAccount.findOne({ where: { UserId: user.id } });

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

      return next(createError(402, 'You have exceeded your token allowance. Please upgrade your plan or add credits.'));
    }

    return next();
  } catch (error) {
    console.error('Token allowance check error:', error);
    // Pass the error to the global error handler
    return next(error);
  }
};

// Function to gracefully close the Redis client connection
const closeRateLimiter = async (client = null) => {
  const clientToClose = client || redisClient;
  if (clientToClose && typeof clientToClose.quit === 'function') {
    try {
      await clientToClose.quit();
      console.log('Redis client disconnected.');
    } catch (err) {
      console.error('Error closing Redis client:', err);
    }
  }

  // If we are closing the global client, nullify it
  if (clientToClose === redisClient) {
    redisClient = null;
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

    if (redisClient && redisClient.status === 'ready') {
      // Redis-based rate limiting using a sorted set
      // Clean up old entries that are outside the time window
      const [[, zremrangeResult], [, zaddResult], [, expireResult], [, zcardResult]] = await redisClient
        .multi()
        .zremrangebyscore(key, 0, now - windowMs)
        .zadd(key, now, now.toString())
        .expire(key, Math.ceil(windowMs / 1000))
        .zcard(key)
        .exec();
      requestCount = zcardResult;
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

const getRateLimiterClient = () => redisClient;

module.exports = {
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
  createPublicRateLimiter, // Export the new function
  connectRateLimiter, // Export for setup
  closeRateLimiter, // Export for graceful shutdown in tests
  getRateLimiterClient,
};
