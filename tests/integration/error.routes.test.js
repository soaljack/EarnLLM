// Mock dependencies first
jest.mock('../../src/middleware/rateLimit.middleware', () => ({
  createPublicRateLimiter: () => (req, res, next) => next(),
  rateLimitByPlan: (req, res, next) => next(),
  checkDailyQuota: (req, res, next) => next(),
  checkTokenAllowance: (req, res, next) => next(),
  connectRateLimiter: jest.fn(),
  closeRateLimiter: jest.fn(),
}));

jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  BillingAccount: {
    create: jest.fn(),
  },
  PricingPlan: {
    findOne: jest.fn(),
  },
}));

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const app = require('../../app');
const { User } = require('../../src/models');

describe('Error Handling Integration Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('404 Not Found Handler', () => {
    it('should return 404 Not Found for a route that does not exist', async () => {
      const res = await request(app)
        .get('/api/non-existent-route')
        .expect(StatusCodes.NOT_FOUND);

      expect(res.body).toEqual({
        status: 'error',
        message: 'Not Found',
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle ApiError thrown from controllers', async () => {
      // Mock User.findOne to return a user, simulating that the email is already in use.
      User.findOne.mockResolvedValue({ id: 1, email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(StatusCodes.CONFLICT);

      expect(res.body).toEqual({
        status: 'error',
        message: 'User with this email already exists',
      });
    });
  });
});
