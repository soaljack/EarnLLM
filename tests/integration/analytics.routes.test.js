const request = require('supertest');
const app = require('../../app');
const { User, ApiUsage, BillingAccount } = require('../../src/models');

// Mock the entire auth middleware module
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('Analytics Routes', () => {
  let adminUser;
  let regularUser;

  beforeEach(() => {
    jest.clearAllMocks();

    adminUser = { id: 999, isAdmin: true };
    regularUser = { id: 1, isAdmin: false };

    // Default to admin access for most tests
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = adminUser;
      next();
    });
    authMiddleware.requireAdmin.mockImplementation((req, res, next) => next());
  });

  const testAdminEndpoint = (endpoint) => {
    describe(`GET ${endpoint}`, () => {
      it('should return 200 for an admin user', async () => {
        // Mock underlying services to return empty but valid data structures
        User.count.mockResolvedValue(100);
        User.findAll.mockResolvedValue([]);
        ApiUsage.sum.mockResolvedValue(50000);
        ApiUsage.count.mockResolvedValue(1200);
        BillingAccount.sum.mockResolvedValue(250.75);

        const response = await request(app).get(endpoint).expect(200);
        expect(response.body).toBeInstanceOf(Object);
      });

      it('should return 403 for a non-admin user', async () => {
        // Override default mock to simulate a regular user
        authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
          req.user = regularUser;
          next();
        });
        // Use the real implementation to check the user's role
        authMiddleware.requireAdmin.mockImplementation(jest.requireActual('../../src/middleware/auth.middleware').requireAdmin);

        await request(app).get(endpoint).expect(403);
      });

      it('should return 401 for an unauthenticated request', async () => {
        // Override default mock to simulate no user
        authMiddleware.authenticateJWT.mockImplementation((req, res, next) => next());

        await request(app).get(endpoint).expect(401);
      });
    });
  };

  // Run tests for all admin-only analytics endpoints
  testAdminEndpoint('/api/analytics/overview');
  testAdminEndpoint('/api/analytics/user-growth');
  testAdminEndpoint('/api/analytics/revenue');
  testAdminEndpoint('/api/analytics/usage-metrics');

  describe('GET /api/analytics/revenue date filtering', () => {
    it('should correctly pass date filters to the service', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';

      // Mock service calls to resolve successfully
      BillingAccount.sum.mockResolvedValue(1000);
      BillingAccount.findAll.mockResolvedValue([]);

      await request(app)
        .get(`/api/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      // Check that the date range was used in the query
      const expectedQuery = {
        where: {
          createdAt: {
            [expect.anything()]: new Date(startDate),
            [expect.anything()]: new Date(`${endDate}T23:59:59.999Z`),
          },
        },
      };

      // Example check on one of the model calls
      expect(BillingAccount.sum).toHaveBeenCalledWith('transactionAmount', expect.objectContaining(expectedQuery));
    });
  });
});
