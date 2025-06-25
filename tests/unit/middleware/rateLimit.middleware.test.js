/**
 * Unit Tests for Rate Limiting Middleware
 */

// Set a dummy Redis URL to ensure the middleware uses the Redis client path
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock dependencies BEFORE requiring the middleware
// Global mock for sequelize is in tests/__mocks__/sequelize.js

// We need to mock the models so we can spy on their methods
jest.mock('../../../src/models', () => ({
  ApiUsage: {
    count: jest.fn(),
  },
  BillingAccount: {
    findOne: jest.fn(),
  },
}));
jest.mock('http-errors', () => {
  const createError = jest.fn((code, message) => {
    const err = new Error(message);
    err.status = code;
    return err;
  });
  return createError;
});

const createError = require('http-errors');
const {
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
  connectRateLimiter,
  closeRateLimiter,
} = require('../../../src/middleware/rateLimit.middleware');
const { ApiUsage, BillingAccount } = require('../../../src/models');

describe('Rate Limiting Middleware', () => {
  let req;
  let res;
  let next;
  const mockRedisClient = {
    zCard: jest.fn(),
    zAdd: jest.fn(),
    zRemRangeByScore: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    isReady: true,
    connect: jest.fn().mockResolvedValue(),
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
  };

  // Use beforeAll/afterAll to connect/disconnect the mocked client once
  beforeAll(async () => {
    await connectRateLimiter(mockRedisClient);
  });

  afterAll(async () => {
    await closeRateLimiter(mockRedisClient);
  });

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();

    req = {
      user: {
        id: 1,
        PricingPlan: {
          requestsPerMinute: 100,
          requestsPerDay: 1000,
          tokenAllowance: 50000,
        },
        BillingAccount: {
          tokenUsageThisMonth: 10000,
          creditBalance: 0,
        },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    next = jest.fn();

    // Reset mock implementations to defaults
    ApiUsage.count.mockResolvedValue(500);
    BillingAccount.findOne.mockResolvedValue(req.user.BillingAccount);
    mockRedisClient.zCard.mockResolvedValue(50);
  });

  describe('rateLimitByPlan', () => {
    test('should allow request and set headers when under rate limit', async () => {
      await rateLimitByPlan(req, res, next);
      expect(mockRedisClient.zCard).toHaveBeenCalledWith('ratelimit:1');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50); // 100 - 50 = 50
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should block request when rate limit is exceeded', async () => {
      mockRedisClient.zCard.mockResolvedValue(101); // Exceeds the limit of 100
      await rateLimitByPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Too Many Requests' }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next(error) if redis fails', async () => {
      const redisError = new Error('Redis is down');
      mockRedisClient.zCard.mockRejectedValue(redisError);
      await rateLimitByPlan(req, res, next);
      expect(next).toHaveBeenCalledWith(redisError);
    });
  });

  describe('checkDailyQuota', () => {
    test('should block request when daily quota is exceeded', async () => {
      ApiUsage.count.mockResolvedValue(1001); // Exceeds the limit of 1000
      await checkDailyQuota(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Quota Exceeded' }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkTokenAllowance', () => {
    test('should call next with error if billing account is missing', async () => {
      BillingAccount.findOne.mockResolvedValue(null);
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(createError).toHaveBeenCalledWith(500, 'Pricing plan or billing account not found.');
    });

    test('should block request when token allowance is exceeded', async () => {
      req.user.BillingAccount.tokenUsageThisMonth = 50001; // Exceeds allowance
      BillingAccount.findOne.mockResolvedValue(req.user.BillingAccount);
      await checkTokenAllowance(req, res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token Allowance Exceeded' }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
