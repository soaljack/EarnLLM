const request = require('supertest');
const app = require('../../app');
const { User, ApiUsage } = require('../../src/models');

// Mock the entire auth middleware module
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()),
  authenticateApiKey: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
  requireApiPermission: jest.fn(() => (req, res, next) => next()),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('User Routes', () => {
  let testUser;
  let adminUser;

  beforeEach(() => {
    // Reset all mocks before each test to ensure isolation
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
      update: jest.fn(function (values) {
        Object.assign(this, values);
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
  });

  describe('Standard User Routes', () => {
    beforeEach(() => {
      // For standard routes, mock authenticateJWT to attach a regular user
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        User.findByPk.mockResolvedValue(testUser); // Ensure controller can find the user
        next();
      });
    });

    it('GET /api/users/me/usage - should return usage stats', async () => {
      ApiUsage.sum.mockResolvedValue(3500);
      ApiUsage.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [
          { model: 'gpt-4', totalTokens: 1000 },
          { model: 'gpt-3.5-turbo', totalTokens: 2500 },
        ],
      });

      const response = await request(app).get('/api/users/me/usage').expect(200);

      expect(response.body.totals.totalTokens).toBe(3500);
      expect(response.body.breakdownByModel).toHaveLength(2);
      expect(ApiUsage.sum).toHaveBeenCalledWith('totalTokens', { where: { UserId: testUser.id } });
    });

    it("PUT /api/users/me - should update the user's profile", async () => {
      const updatedFirstName = 'UpdatedName';
      testUser.update.mockResolvedValue({ ...testUser, firstName: updatedFirstName });

      const response = await request(app)
        .put('/api/users/me')
        .send({ firstName: updatedFirstName })
        .expect(200);

      expect(testUser.update).toHaveBeenCalledWith({ firstName: updatedFirstName });
      expect(response.body.user.firstName).toBe(updatedFirstName);
    });

    it('PUT /api/users/me - should update password correctly', async () => {
      testUser.validatePassword.mockResolvedValue(true);
      testUser.update.mockResolvedValue(testUser);

      await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' })
        .expect(200);

      expect(testUser.validatePassword).toHaveBeenCalledWith('Password123!');
      expect(testUser.update).toHaveBeenCalledWith({ password: 'NewPassword456!' });
    });

    it('PUT /api/users/me - should fail password update with wrong current password', async () => {
      testUser.validatePassword.mockResolvedValue(false);

      const response = await request(app)
        .put('/api/users/me')
        .send({ currentPassword: 'wrong-password', newPassword: 'new-password' })
        .expect(401);

      expect(testUser.validatePassword).toHaveBeenCalledWith('wrong-password');
      expect(testUser.update).not.toHaveBeenCalled();
      expect(response.body.message).toBe('Incorrect current password.');
    });
  });

  describe('Admin Routes', () => {
    beforeEach(() => {
      // For admin routes, attach an admin user
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
    });

    it('GET /api/users - should return a list of all users', async () => {
      const mockUsers = { count: 2, rows: [testUser, adminUser] };
      User.findAndCountAll.mockResolvedValue(mockUsers);

      const response = await request(app).get('/api/users?page=1&limit=10').expect(200);

      expect(response.body.users.length).toBe(2);
      expect(User.findAndCountAll).toHaveBeenCalled();
    });

    it('GET /api/users/:id - should return a specific user', async () => {
      User.findByPk.mockResolvedValue(testUser);

      const response = await request(app).get(`/api/users/${testUser.id}`).expect(200);

      expect(response.body.user.email).toBe(testUser.email);
      expect(User.findByPk).toHaveBeenCalledWith(testUser.id.toString(), expect.any(Object));
    });

    it('GET /api/users - should be forbidden for a non-admin user', async () => {
      // Override the default admin mock for this specific test
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser; // Attach a non-admin user
        next();
      });

      // Make requireAdmin check the actual user role
      authMiddleware.requireAdmin.mockImplementation(jest.requireActual('../../src/middleware/auth.middleware').requireAdmin);

      const response = await request(app).get('/api/users').expect(403);
      expect(response.body.message).toBe('Forbidden. Admins only.');
    });
  });
});
