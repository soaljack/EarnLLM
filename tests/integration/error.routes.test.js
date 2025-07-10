const { StatusCodes } = require('http-status-codes');
const request = require('supertest');
const { startServer, stopServer } = require('./helpers');

// Mock models before they are imported by the app
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  PricingPlan: { findOne: jest.fn() },
  BillingAccount: { create: jest.fn() },
  ApiKey: { findOne: jest.fn() },
  LlmModel: { findOne: jest.fn() },
  ApiUsage: { findOne: jest.fn() },
  ExternalModel: { findOne: jest.fn() },
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(),
    sync: jest.fn().mockResolvedValue(),
    transaction: jest.fn().mockImplementation(async (callback) => callback('mockTransaction')),
  },
}));

const { User, PricingPlan } = require('../../src/models');

describe('Error Handling Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
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
      User.findOne.mockResolvedValue({ id: 1, email: 'test@example.com' });
      PricingPlan.findOne.mockResolvedValue({ id: 1, name: 'Starter' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(StatusCodes.CONFLICT);

      expect(res.body).toEqual({
        status: 'error',
        message: 'User with this email already exists',
      });
    });
  });
});
