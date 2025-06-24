/**
 * Unit Tests for Rate Limiting Middleware
 */
const { rateLimitByPlan, checkDailyQuota, checkTokenAllowance } = require('../../../src/middleware/rateLimit.middleware');
const { ApiUsage } = require('../../../src/models');
const redis = require('redis');

// Mock models
jest.mock('../../../src/models', () => ({
  ApiUsage: {
    count: jest.fn(),
  },
  // PricingPlan and BillingAccount are no longer mocked here
  // as they are expected to be on the req.user object.
}));

// Mock createError
jest.mock('http-errors', () => jest.fn((code, message) => ({
  status: code,
  message,
})));

// Mock Redis
jest.mock('redis', () => {
  const mockRedisClient = {
    isReady: true, // Set to true to avoid connect logic in tests
    connect: jest.fn().mockResolvedValue(true),
    zRemRangeByScore: jest.fn().mockResolvedValue(1),
    zAdd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    zCard: jest.fn().mockResolvedValue(50), // Simulate 50 requests in window
    on: jest.fn(),
    multi: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([null, [null, 51]]),
  };
  // Allow chaining for multi()
  mockRedisClient.multi.mockImplementation(() => ({
    zRemRangeByScore: jest.fn().mockReturnThis(),
    zAdd: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    zCard: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 1], [null, 51]]),
  }));

  return {
    createClient: jest.fn().mockReturnValue(mockRedisClient),
  };
});

describe('Rate Limiting Middleware', () => {
  let req;
  let res;
  let next;
  let mockPlan;
  let mockAccount;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPlan = {
      id: 1,
      name: 'Test Plan',
      requestsPerMinute: 100,
      requestsPerDay: 1000,
      tokenAllowance: 50000,
    };

    mockAccount = {
      id: 1,
      UserId: 1,
      tokenUsageThisMonth: 10000,
      creditBalance: 0,
    };

    req = {
      user: {
        id: 1,
        PricingPlanId: 1,
        // The middleware now expects these to be pre-loaded
        PricingPlan: mockPlan,
        BillingAccount: mockAccount,
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    next = jest.fn();

    // Default mocks
    ApiUsage.count.mockResolvedValue(500); // Half the daily quota by default
  });

  describe('rateLimitByPlan', () => {
    test('should skip rate limiting if no user is attached to request', async () => {
      req.user = null;
      await rateLimitByPlan(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should skip rate limiting if no pricing plan on user', async () => {
      req.user.PricingPlan = null;
      await rateLimitByPlan(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should skip rate limiting if plan has no requestsPerMinute limit', async () => {
      req.user.PricingPlan.requestsPerMinute = null;
      await rateLimitByPlan(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should allow request when under rate limit', async () => {
      await rateLimitByPlan(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 49);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
      expect(next).toHaveBeenCalledWith();
    });

    test('should block request when rate limit exceeded', async () => {
      const mockRedisClient = redis.createClient();
      // This setup mocks the 'rate-limiter-flexible' library's response for a blocked request
      const rateLimitError = { remainingPoints: 0 };
      jest.spyOn(mockRedisClient, 'multi').mockImplementation(() => ({
        zRemRangeByScore: jest.fn().mockReturnThis(),
        zAdd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        zCard: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(rateLimitError),
      }));

      await rateLimitByPlan(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too Many Requests',
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkDailyQuota', () => {
    test('should skip quota check if no user is attached to request', async () => {
      req.user = null;
      await checkDailyQuota(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should skip quota check if no pricing plan on user', async () => {
      req.user.PricingPlan = null;
      await checkDailyQuota(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should skip quota check if plan has no requestsPerDay limit', async () => {
      req.user.PricingPlan.requestsPerDay = null;
      await checkDailyQuota(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should allow request when under daily quota', async () => {
      await checkDailyQuota(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-Daily-Quota-Limit', 1000);
      expect(res.setHeader).toHaveBeenCalledWith('X-Daily-Quota-Remaining', 500);
      expect(next).toHaveBeenCalledWith();
    });

    test('should block request when daily quota exceeded', async () => {
      ApiUsage.count.mockResolvedValue(1000);
      await checkDailyQuota(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Quota Exceeded',
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkTokenAllowance', () => {
    test('should skip token check if no user is attached to request', async () => {
      req.user = null;
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should error if pricing plan or billing account not found', async () => {
      req.user.PricingPlan = null;
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 500,
        message: 'Pricing plan or billing account not found.',
      }));
    });

    test('should skip token check if plan has unlimited tokens', async () => {
      req.user.PricingPlan.tokenAllowance = null;
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should allow request when under token allowance', async () => {
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should block request when token allowance exceeded', async () => {
      req.user.BillingAccount.tokenUsageThisMonth = 60000;
      await checkTokenAllowance(req, res, next);
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Token Allowance Exceeded',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow pay-as-you-go users with credit balance to exceed token allowance', async () => {
      req.user.BillingAccount.tokenUsageThisMonth = 60000;
      req.user.BillingAccount.creditBalance = 10.0;
      req.user.PricingPlan.code = 'pay-as-you-go';
      await checkTokenAllowance(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
