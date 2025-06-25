// Mock dependencies FIRST to ensure they are available for other imports
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn(),
  requireAdmin: jest.fn(),
  authenticateApiKey: jest.fn(),
}));

jest.mock('../../src/models', () => ({
  User: { count: jest.fn(), findAll: jest.fn() },
  ApiUsage: {
    sum: jest.fn(), count: jest.fn(), findOne: jest.fn(), findAll: jest.fn(),
  },
  BillingAccount: { sum: jest.fn(), findAll: jest.fn() },
  ApiKey: { count: jest.fn() },
  LlmModel: {},
  ExternalModel: {},
  sequelize: {
    Op: {
      gte: Symbol('gte'),
      lte: Symbol('lte'),
    },
    fn: jest.fn((func, col) => `${func}(${col})`),
    col: jest.fn((col) => col),
  },
}));

const request = require('supertest');
const { Op } = require('sequelize');
const app = require('../../app');
const authMiddleware = require('../../src/middleware/auth.middleware');
const {
  User, ApiUsage, BillingAccount, ApiKey,
} = require('../../src/models');

describe('Analytics Routes', () => {
  let adminUser;
  let regularUser;

  beforeEach(() => {
    jest.clearAllMocks();

    adminUser = { id: 999, isAdmin: true };
    regularUser = { id: 1, isAdmin: false };

    // Default middleware to admin access
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = adminUser;
      next();
    });

    authMiddleware.requireAdmin.mockImplementation((req, res, next) => {
      if (req.user && req.user.isAdmin) {
        return next();
      }
      return res.status(403).json({ message: 'Forbidden' });
    });
  });

  const testAdminEndpoint = (endpoint) => {
    describe(`GET ${endpoint}`, () => {
      it('should return 200 for an admin user', async () => {
        // Arrange: Mock underlying services to return valid data
        // Provide comprehensive mocks to satisfy all analytics endpoints
        User.count.mockResolvedValue(100);
        User.findAll.mockResolvedValue([]);
        ApiKey.count.mockResolvedValue(50);
        ApiUsage.sum.mockResolvedValue(50000); // Keep for any legacy use
        ApiUsage.findOne.mockResolvedValue({
          totalTokens: 1000, totalCostCents: 10, requestCount: 100,
        });
        ApiUsage.findAll.mockResolvedValue([]);
        BillingAccount.sum.mockResolvedValue(250.75); // Keep for any legacy use
        BillingAccount.findAll.mockResolvedValue([{ getDataValue: () => 1000 }]);

        // Act
        const response = await request(app).get(endpoint).expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Object);
      });

      it('should return 403 for a non-admin user', async () => {
        // Arrange: Simulate a regular user making the request
        authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
          req.user = regularUser;
          next();
        });

        // Act & Assert
        await request(app).get(endpoint).expect(403);
      });

      it('should return 403 for an unauthenticated request', async () => {
        // Arrange: Simulate no user being authenticated
        authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
          req.user = null; // Explicitly unauthenticated
          next();
        });

        // Act & Assert
        await request(app).get(endpoint).expect(403);
      });
    });
  };

  // Test all admin-only analytics endpoints
  testAdminEndpoint('/api/analytics/admin/overview');
  testAdminEndpoint('/api/analytics/admin/users-growth');
  testAdminEndpoint('/api/analytics/admin/revenue');
  // Removed test for non-existent /usage-metrics endpoint

  describe('GET /api/analytics/admin/revenue with date filtering', () => {
    it('should correctly pass date filters to the database query', async () => {
      // Arrange
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';
      BillingAccount.findAll.mockResolvedValue([{ getDataValue: () => 1000 }]);
      ApiUsage.findOne.mockResolvedValue({
        totalTokens: 1000, totalCostCents: 10, requestCount: 100,
      });
      ApiUsage.findAll.mockResolvedValue([]);

      // Act
      await request(app)
        .get(`/api/analytics/admin/revenue?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      // Assert
      // The controller uses helper functions, so we can't easily check the final sum query.
      // Instead, we check that one of the underlying queries was called with a date filter.
      expect(ApiUsage.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            [Op.gte]: new Date('2023-01-01'),
            [Op.lte]: new Date('2023-01-31'),
          }),
        }),
      }));
    });
  });
});
