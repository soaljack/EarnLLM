const request = require('supertest');

// Hoist mocks to the top
jest.mock('../../src/middleware/auth.middleware');
jest.mock('../../src/models');

describe('User Routes', () => {
  let app;
  let authMiddleware;
  let User;
  let ApiUsage;
  let testUser;
  let adminUser;

  beforeEach(() => {
    jest.resetModules();

    app = require('../../app');
    authMiddleware = require('../../src/middleware/auth.middleware');
    const models = require('../../src/models');
    User = models.User;
    ApiUsage = models.ApiUsage;

    jest.clearAllMocks();

    testUser = {
      id: 1,
      email: 'user-routes-test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      isAdmin: false,
      validatePassword: jest.fn(),
      save: jest.fn(function () {
        return Promise.resolve(this);
      }),
    };

    adminUser = {
      id: 2,
      email: 'admin-routes-test@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      isAdmin: true,
    };

    // Comprehensive mocks for model methods
    User.findByPk.mockResolvedValue(testUser);
    User.findAndCountAll.mockResolvedValue({ count: 2, rows: [testUser, adminUser] });
    ApiUsage.sum.mockResolvedValue(3500);
    ApiUsage.findAll.mockResolvedValue([]);
    ApiUsage.findOne.mockResolvedValue({ totalTokens: 3500 });
    ApiUsage.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        { model: 'gpt-4', totalTokens: 1000 },
        { model: 'gpt-3.5-turbo', totalTokens: 2500 },
      ],
    });
  });

  describe('Standard User Routes', () => {
    beforeEach(() => {
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
    });

    it('GET /api/users/me/usage - should return usage stats', async () => {
      const response = await request(app).get('/api/users/me/usage').expect(200);
      expect(response.body.totals.totalTokens).toBe(3500);
    });

    it("PUT /api/users/me - should update the user's profile", async () => {
      const updatedFirstName = 'UpdatedName';

      const response = await request(app)
        .put('/api/users/me')
        .send({ firstName: updatedFirstName })
        .expect(200);

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
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      authMiddleware.requireAdmin.mockImplementation((req, res, next) => next());
    });

    it('GET /api/users - should return a list of all users', async () => {
      const response = await request(app).get('/api/users?page=1&limit=10').expect(200);
      expect(response.body.users.length).toBe(2);
      expect(User.findAndCountAll).toHaveBeenCalled();
    });

    it('GET /api/users/:id - should return a specific user', async () => {
      const response = await request(app).get(`/api/users/${testUser.id}`).expect(200);
      expect(response.body.user.email).toBe(testUser.email);
      expect(User.findByPk).toHaveBeenCalledWith(testUser.id.toString(), expect.any(Object));
    });

    it('GET /api/users - should be forbidden for a non-admin user', async () => {
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });

      authMiddleware.requireAdmin.mockImplementation((req, res, next) => {
        if (req.user && req.user.role === 'admin') {
          return next();
        }
        return res.status(403).json({ message: 'Forbidden. Admins only.' });
      });

      const response = await request(app).get('/api/users').expect(403);
      expect(response.body.message).toBe('Forbidden. Admins only.');
    });
  });
});
