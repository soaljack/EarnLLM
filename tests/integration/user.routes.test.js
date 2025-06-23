const request = require('supertest');
const express = require('express');

// Mock dependencies before they are imported by routes
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn(),
  requireAdmin: jest.fn(),
}));

jest.mock('../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  ApiUsage: {
    findAll: jest.fn(),
    sum: jest.fn(),
    count: jest.fn(),
  },
}));

// Import modules under test
const userRoutes = require('../../src/routes/user.routes');
const { User, ApiUsage } = require('../../src/models');
const authMiddleware = require('../../src/middleware/auth.middleware');

describe('User Routes (Mocked)', () => {
  let app;
  let mockUser;
  let mockAdmin;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);

    // Mock user objects that will be returned by our model mocks
    mockUser = {
      id: 'user-uuid-123',
      email: 'user@test.com',
      firstName: 'Test',
      lastName: 'User',
      isAdmin: false,
      update: jest.fn().mockImplementation(function(data) {
        Object.assign(this, data);
        return Promise.resolve(this);
      }),
      validatePassword: jest.fn(),
    };

    mockAdmin = {
      id: 'admin-uuid-456',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      isAdmin: true,
    };
  });

  beforeEach(() => {
    jest.resetAllMocks();

    // Default middleware mock: success, sets req.user
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Default admin middleware mock
    authMiddleware.requireAdmin.mockImplementation((req, res, next) => {
      if (req.user && req.user.isAdmin) {
        return next();
      }
      return res.status(403).json({ error: 'Forbidden' });
    });
  });

  describe('GET /api/users/me/usage', () => {
    test('should return user usage statistics', async () => {
      ApiUsage.sum.mockResolvedValue(5000);
      ApiUsage.findAll.mockResolvedValue([{ model: 'gpt-4', tokens: 1000 }]);

      const response = await request(app).get('/api/users/me/usage').expect(200);

      expect(response.body.totals.totalTokens).toBe(5000);
      expect(response.body.breakdownByModel[0].model).toBe('gpt-4');
      expect(ApiUsage.sum).toHaveBeenCalledWith('totalTokens', expect.any(Object));
    });
  });

  describe('PUT /api/users/me', () => {
    test('should update user profile for non-password fields', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ firstName: 'UpdatedName' })
        .expect(200);

      expect(mockUser.update).toHaveBeenCalledWith({ firstName: 'UpdatedName' });
      expect(response.body.user.firstName).toBe('UpdatedName');
    });

    test('should update password when current password is correct', async () => {
      mockUser.validatePassword.mockResolvedValue(true);

      await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'correct-password', newPassword: 'new-password' })
        .expect(200);

      expect(mockUser.validatePassword).toHaveBeenCalledWith('correct-password');
      expect(mockUser.update).toHaveBeenCalledWith({ password: 'new-password' });
    });

    test('should reject password update when current password is incorrect', async () => {
      mockUser.validatePassword.mockResolvedValue(false);

      await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'wrong-password', newPassword: 'new-password' })
        .expect(401);

      expect(mockUser.validatePassword).toHaveBeenCalledWith('wrong-password');
      expect(mockUser.update).not.toHaveBeenCalled();
    });
  });

  describe('Admin Routes', () => {
    beforeEach(() => {
      // For admin routes, set the authenticated user to be the admin
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = mockAdmin;
        next();
      });
    });

    test('GET /api/users - should list all users for an admin', async () => {
      User.findAndCountAll.mockResolvedValue({ count: 2, rows: [mockUser, mockAdmin] });

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body.users.length).toBe(2);
      expect(response.body.totalItems).toBe(2);
    });

    test('GET /api/users/:id - should get a specific user for an admin', async () => {
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app).get(`/api/users/${mockUser.id}`).expect(200);

      expect(response.body.user.id).toBe(mockUser.id);
    });

    test('GET /api/users - should be forbidden for a non-admin user', async () => {
      // Override auth to be a non-admin for this test
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });

      await request(app).get('/api/users').expect(403);
    });
  });
});
