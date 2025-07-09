/**
 * Unit Tests for Rate Limiting Middleware
 */

// 1. Reset modules and unmock the real middleware
jest.resetModules();
jest.unmock('../../../src/middleware/rateLimit.middleware');

// 2. Mock all dependencies BEFORE requiring the middleware
process.env.REDIS_URL = 'redis://localhost:6379'; // Set dummy URL for Redis

const mockSequelizeModels = require('../../mocks/sequelize.mock');
jest.mock('../../../src/models', () => mockSequelizeModels);

const mockTransaction = {
  zRemRangeByScore: jest.fn().mockReturnThis(),
  zAdd: jest.fn().mockReturnThis(),
  zCard: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedisClient = {
  isReady: true,
  connect: jest.fn().mockResolvedValue(),
  quit: jest.fn().mockResolvedValue('OK'),
  multi: jest.fn(() => mockTransaction),
  on: jest.fn(),
};

// Mock the Redis client creation
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock http-errors to be able to check for status and message
jest.mock('http-errors', () => jest.fn((code, message) => {
  const err = new Error(message);
  err.status = code;
  return err;
}));

// 3. Now, require the module under test and its dependencies
const {
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
  connectRateLimiter,
  closeRateLimiter,
} = require('../../../src/middleware/rateLimit.middleware');
const { ApiUsage, BillingAccount } = require('../../../src/models'); // Will be the mocked versions

// 4. Describe block with tests
describe('Rate Limiting Middleware', () => {
  let req;
  let res;
  let next;

  // Use beforeAll/afterAll to connect/disconnect the mocked client once
  beforeAll(async () => {
    // The middleware's internal connect function will use the mocked client
    await connectRateLimiter();
  });

  afterAll(async () => {
    await closeRateLimiter();
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
    BillingAccount.findOne.mockResolvedValue({
      tokenUsageThisMonth: 10000,
      creditBalance: 0,
    });
    // Reset redis transaction mock
    mockTransaction.exec.mockReset();
  });

  describe('rateLimitByPlan', () => {
    test('should allow request if rate limit is not exceeded', async () => {
      const requestCount = 3;
      const requestsPerMinute = 5;
      req.user.PricingPlan.requestsPerMinute = requestsPerMinute;
      mockTransaction.exec.mockResolvedValue([null, null, requestCount, null]);

      await rateLimitByPlan(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', requestsPerMinute);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', requestsPerMinute - requestCount);
    });

    test('should block request if rate limit is exceeded', async () => {
      const requestCount = 10;
      const requestsPerMinute = 5;
      req.user.PricingPlan.requestsPerMinute = requestsPerMinute;
      mockTransaction.exec.mockResolvedValue([null, null, requestCount, null]);

      await rateLimitByPlan(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(429);
      expect(error.message).toBe(`Rate limit of ${requestsPerMinute} requests per minute exceeded`);
    });

    test('should handle Redis errors gracefully by failing open', async () => {
      mockTransaction.exec.mockRejectedValue(new Error('Redis error'));
      await rateLimitByPlan(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkDailyQuota', () => {
    test('should block request when daily quota is exceeded', async () => {
      ApiUsage.count.mockResolvedValue(1001); // Exceeds the limit of 1000
      await checkDailyQuota(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(429);
      expect(error.message).toBe(`You have exceeded your daily request quota of ${req.user.PricingPlan.requestsPerDay}. Please try again tomorrow.`);
    });
  });

  describe('checkTokenAllowance', () => {
    test('should call next with error if billing account is missing', async () => {
      // Setup: Simulate user with no billing account found
      BillingAccount.findOne.mockResolvedValue(null);

      await checkTokenAllowance(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(500);
      expect(error.message).toBe('Pricing plan or billing account not found.');
    });

    test('should block request when token allowance is exceeded', async () => {
      // Exceeds allowance
      BillingAccount.findOne.mockResolvedValue({
        tokenUsageThisMonth: 50001,
        creditBalance: 0,
      });

      await checkTokenAllowance(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(402);
      expect(error.message).toContain('You have exceeded your token allowance');
    });
  });
});
