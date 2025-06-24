/**
 * Integration tests for API key routes with a robust mocked dependency setup
 */

const request = require('supertest');
const express = require('express');

// --- Jest Mocks ---
// We mock the modules first, before they are required by any other module.

jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    // A simple mock that attaches a test user to the request if an auth header is present.
    if (req.headers.authorization) {
      req.user = { id: 1, email: 'apikey-test@example.com' };
      return next();
    }
    // For tests that need to fail authentication, we can re-mock this implementation.
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }),
  authenticateApiKey: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
}));

jest.mock('../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  ApiKey: {
    generateKey: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));

// --- Modules under test ---
// Now we can require the modules. They will get the mocked versions.
const apiKeyRoutes = require('../../src/routes/apiKey.routes');
const { ApiKey } = require('../../src/models');
const authMiddleware = require('../../src/middleware/auth.middleware');

// --- Test Suite ---

describe('API Key Routes (Mocked)', () => {
  let app;
  const testUser = { id: 1, email: 'apikey-test@example.com' };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/api-keys', apiKeyRoutes);

    // Global error handler for cleaner test output
    app.use((err, req, res, _next) => {
      const status = err.status || 500;
      const message = err.message || 'Something went wrong';
      res.status(status).json({ status: 'error', message });
    });
  });

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    jest.clearAllMocks();

    // Default auth mock behavior for authenticated routes
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });
  });

  describe('POST /api/api-keys', () => {
    test('should create a new API key', async () => {
      const mockCreatedKey = { id: 101, name: 'Test API Key', UserId: 1 };
      ApiKey.create.mockResolvedValue(mockCreatedKey);
      ApiKey.generateKey.mockReturnValue({
        prefix: 'earn_test_',
        fullKey: 'earn_test_full_key_string',
        hashedKey: 'hashed_key_string',
      });

      const response = await request(app)
        .post('/api/api-keys')
        .send({ name: 'Test API Key' })
        .expect(201);

      expect(response.body.key).toBe('earn_test_full_key_string');
      expect(ApiKey.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test API Key',
        UserId: testUser.id,
      }));
    });
  });

  describe('GET /api/api-keys', () => {
    test('should list user API keys', async () => {
      const mockApiKeys = [{ id: 101, name: 'Test API Key' }];
      ApiKey.findAll.mockResolvedValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys').expect(200);

      expect(response.body[0].name).toBe('Test API Key');
      expect(ApiKey.findAll).toHaveBeenCalledWith({
        where: { UserId: testUser.id },
        attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt', 'permissions', 'createdAt'],
      });
    });
  });

  describe('POST /api/api-keys/:id/revoke', () => {
    test('should revoke an API key', async () => {
      const mockKeyInstance = {
        id: 101,
        isActive: true,
        update: jest.fn().mockResolvedValue({ id: 101, isActive: false }),
      };
      ApiKey.findOne.mockResolvedValue(mockKeyInstance);

      const response = await request(app).post('/api/api-keys/101/revoke').expect(200);

      expect(response.body.message).toBe('API key revoked successfully');
      expect(response.body.isActive).toBe(false);
      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { id: '101', UserId: testUser.id } });
      expect(mockKeyInstance.update).toHaveBeenCalledWith({ isActive: false });
    });

    test('should return 404 for non-existent key', async () => {
      ApiKey.findOne.mockResolvedValue(null);
      await request(app).post('/api/api-keys/999/revoke').expect(404);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    test('should delete an API key', async () => {
      ApiKey.destroy.mockResolvedValue(1);

      const response = await request(app).delete('/api/api-keys/101').expect(200);

      expect(response.body.message).toBe('API key deleted successfully');
      expect(ApiKey.destroy).toHaveBeenCalledWith({ where: { id: '101', UserId: testUser.id } });
    });

    test('should return 404 when trying to delete a non-existent key', async () => {
      ApiKey.destroy.mockResolvedValue(0);

      await request(app).delete('/api/api-keys/999').expect(404);
      expect(ApiKey.destroy).toHaveBeenCalledWith({ where: { id: '999', UserId: testUser.id } });
    });
  });
});
