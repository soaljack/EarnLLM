// Mock dependencies to be fully self-contained BEFORE app import.
jest.mock('../../src/middleware/authenticateJWT');
jest.mock('../../src/middleware/requireAdmin');
jest.mock('../../src/middleware/authenticateApiKey');
jest.mock('../../src/middleware/requireApiPermission');

jest.mock('../../src/models', () => ({
  sequelize: {
    // Return a descriptive string for sequelize functions to avoid crashes in the mock DB layer.
    fn: jest.fn((fn, col) => `sequelize.fn('${fn}', ${col})`),
    col: jest.fn((col) => `sequelize.col('${col}')`),
    transaction: jest.fn(() => ({
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
  },
  User: {
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  ApiUsage: {
    sum: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../app');
const authenticateJWT = require('../../src/middleware/authenticateJWT');
const requireAdmin = require('../../src/middleware/requireAdmin');
const authenticateApiKey = require('../../src/middleware/authenticateApiKey');
const { User, ApiUsage } = require('../../src/models');

describe('User Routes', () => {
  let testUser;
  let adminUser;

  // Create high-fidelity mocks that behave like Sequelize instances
  beforeEach(() => {
    jest.resetAllMocks();

    const baseUser = {
      save: jest.fn().mockReturnThis(),
      get: jest.fn(function get(options) {
        if (options && options.plain) {
          const { ...rest } = this;
          delete rest.password;
          return rest;
        }
        return this;
      }),
      toJSON: jest.fn(function toJSON() {
        const { ...rest } = this;
        delete rest.password;
        return rest;
      }),
    };

    testUser = {
      ...baseUser,
      id: 1,
      email: 'user-routes-test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      isAdmin: false,
      validatePassword: jest.fn(),
    };

    adminUser = {
      ...baseUser,
      id: 2,
      email: 'admin-routes-test@example.com',
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      isAdmin: true,
    };

    requireAdmin.mockImplementation((req, res, next) => {
      if (req.user && req.user.isAdmin) {
        next();
      } else {
        res.status(403).json({ message: 'Forbidden. Admins only.' });
      }
    });
  });

  describe('Standard User Routes', () => {
    beforeEach(() => {
      authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser; // Use the realistic mock
        return next();
      });
    });

    it('GET /api/users/me/usage - should return usage stats', async () => {
      ApiUsage.findAll.mockResolvedValue([]);
      // Mock a Sequelize-like instance with a .get() method
      const mockUsageResult = {
        totalTokens: 3500,
        totalCostCents: 175,
        requestCount: 10,
        get: jest.fn(function getUsage(options) {
          if (options && options.plain) {
            return this;
          }
          return undefined;
        }),
      };
      ApiUsage.findOne.mockResolvedValue(mockUsageResult);

      const response = await request(app).get('/api/users/me/usage').expect(200);

      expect(response.body.totals.totalTokens).toBe(3500);
      expect(ApiUsage.findAll).toHaveBeenCalledTimes(3);
    });

    it("PUT /api/users/me - should update the user's profile", async () => {
      const updatedFirstName = 'UpdatedName';

      const response = await request(app)
        .put('/api/users/me')
        .send({ firstName: updatedFirstName })
        .expect(200);

      // The controller mutates req.user directly, so we check our mock
      expect(testUser.firstName).toBe(updatedFirstName);
      expect(testUser.save).toHaveBeenCalled();
      expect(response.body.user.firstName).toBe(updatedFirstName);
    });

    it('PUT /api/users/me - should update password correctly', async () => {
      testUser.validatePassword.mockResolvedValue(true);

      await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' })
        .expect(200);

      expect(testUser.validatePassword).toHaveBeenCalledWith('Password123!');
      expect(testUser.save).toHaveBeenCalled();
    });

    it('PUT /api/users/me - should fail password update with wrong current password', async () => {
      testUser.validatePassword.mockResolvedValue(false);

      const response = await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'wrong-password', newPassword: 'new-password' })
        .expect(401);

      expect(testUser.validatePassword).toHaveBeenCalledWith('wrong-password');
      expect(testUser.save).not.toHaveBeenCalled();
      expect(response.body.message).toBe('Invalid current password');
    });
  });

  describe('Admin Routes', () => {
    beforeEach(() => {
      authenticateJWT.mockImplementation((req, res, next) => {
        req.user = adminUser;
        return next();
      });
    });

    it('GET /api/users - should return a list of all users', async () => {
      User.findAndCountAll.mockResolvedValue({ count: 2, rows: [testUser, adminUser] });

      const response = await request(app).get('/api/users?page=1&limit=10').expect(200);

      expect(response.body.users.length).toBe(2);
      expect(User.findAndCountAll).toHaveBeenCalled();
    });

    it('GET /api/users/:id - should return a specific user', async () => {
      const mockUserWithAssociations = {
        ...testUser,
        PricingPlan: { id: 1, name: 'Free' },
        BillingAccount: { id: 1, creditBalance: 100 },
        ApiKeys: [],
        toJSON: () => ({ ...testUser, PricingPlan: { id: 1, name: 'Free' } }),
      };
      User.findByPk.mockResolvedValue(mockUserWithAssociations);
      // Mock a Sequelize-like instance
      const mockUsageResult = {
        totalTokens: 0,
        totalCostCents: 0,
        requestCount: 0,
        get: jest.fn(function getUsage(options) {
          if (options && options.plain) {
            return this;
          }
          return undefined;
        }),
      };
      ApiUsage.findOne.mockResolvedValue(mockUsageResult);

      const response = await request(app).get(`/api/users/${testUser.id}`).expect(200);

      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.PricingPlan.name).toBe('Free');
      expect(User.findByPk).toHaveBeenCalledWith(testUser.id.toString(), expect.any(Object));
    });

    it('GET /api/users - should be forbidden for a non-admin user', async () => {
      authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        return next();
      });

      const response = await request(app).get('/api/users').expect(403);

      expect(response.body.message).toBe('Forbidden. Admins only.');
    });
  });
});
