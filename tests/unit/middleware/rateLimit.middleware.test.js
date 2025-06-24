/**
 * Unit Tests for Rate Limiting Middleware
 */

// Set a dummy Redis URL to ensure the middleware uses the Redis client path
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock dependencies BEFORE requiring the middleware
jest.mock('redis');
jest.mock('../../../src/models');
jest.mock('http-errors', () => jest.fn((code, message) => {
  const err = new Error(message);
  err.status = code;
  return err;
}));

const redis = require('redis');
const { rateLimitByPlan, checkDailyQuota, checkTokenAllowance, connectRateLimiter, closeRateLimiter } = require('../../../src/middleware/rateLimit.middleware');
const { ApiUsage, BillingAccount } = require('../../../src/models');
const createError = require('http-errors');

const mockRedisClient = {
  isReady: true,
  connect: jest.fn().mockResolvedValue(),
  on: jest.fn(),
  zRemRangeByScore: jest.fn().mockResolvedValue(1),
  zAdd: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  zCard: jest.fn().mockResolvedValue(50),
  quit: jest.fn().mockResolvedValue(),
};
redis.createClient.mockReturnValue(mockRedisClient);

describe('Rate Limiting Middleware', () => {
  let req;
  let res;
  let next;

  // Use beforeAll/afterAll to connect/disconnect the mocked client once
  beforeAll(async () => {
    await connectRateLimiter();
  });

  afterAll(async () => {
    await closeRateLimiter();
  });

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();

    // Re-mock createClient before each test to reset call history
    redis.createClient.mockClear().mockReturnValue(mockRedisClient);

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
