const request = require('supertest');

// Hoist the mocks to the top. This ensures that any subsequent 'require' of these modules
// will get the mocked version.
jest.mock('../../src/middleware/auth.middleware');
jest.mock('../../src/models');

describe('API Key Routes', () => {
  let app;
  let authMiddleware;
  let ApiKey;
  let testUser;
  let testKey;

  beforeEach(() => {
    // Reset modules to ensure a fresh state for each test, preventing mock bleed-over.
    jest.resetModules();

    // Re-require the app and middleware inside beforeEach to get the fresh, mocked instances.
    // eslint-disable-next-line global-require
    app = require('../../app');
    // eslint-disable-next-line global-require
    authMiddleware = require('../../src/middleware/auth.middleware');
    // eslint-disable-next-line global-require
    ApiKey = require('../../src/models').ApiKey;

    // --- Mock Data Setup ---
    testUser = { id: 1, email: 'apikey-test@example.com' };
    testKey = {
      id: 101,
      name: 'My Test Key',
      UserId: testUser.id,
      isActive: true,
      save: jest.fn().mockReturnThis(),
      update: jest.fn(async function update(data) {
        Object.assign(this, data);
        return this;
      }),
      destroy: jest.fn().mockResolvedValue(1),
    };

    // --- Mock Implementation Setup ---
    // Provide a specific implementation for the mocked middleware for this test suite.
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      const keyName = 'My New Test Key';
      const mockApiKey = {
        id: 'mock-api-key-id',
        name: keyName,
        key: 'sk-test-mock-key-string',
        prefix: 'sk-test-mock',
        permissions: ['chat:completion', 'embed'],
        expiresAt: null,
        createdAt: new Date().toISOString(),
      };
      ApiKey.create.mockResolvedValue(mockApiKey);

      const response = await request(app)
        .post('/api/api-keys')
        .send({ name: keyName })
        .expect(201);

      expect(ApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: keyName, UserId: testUser.id }),
      );
      expect(response.body).toHaveProperty('key');
      expect(response.body.key).toMatch(/^sk-/);
      expect(response.body.name).toBe(keyName);
    });

    it('should return 400 if name is missing', async () => {
      await request(app).post('/api/api-keys').send({}).expect(400);
      expect(ApiKey.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/api-keys', () => {
    it("should list the user's API keys", async () => {
      ApiKey.findAll.mockResolvedValue([testKey]);

      const response = await request(app).get('/api/api-keys').expect(200);

      expect(ApiKey.findAll).toHaveBeenCalledWith({
        where: { UserId: testUser.id },
        attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt', 'permissions', 'createdAt'],
      });
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('My Test Key');
    });
  });

  describe('POST /api/api-keys/:id/revoke', () => {
    it('should revoke an active API key', async () => {
      ApiKey.findOne.mockResolvedValue(testKey);

      const response = await request(app)
        .post(`/api/api-keys/${testKey.id}/revoke`)
        .expect(200);

      expect(ApiKey.findOne).toHaveBeenCalledWith({
        where: { id: testKey.id.toString(), UserId: testUser.id },
        transaction: expect.anything(),
      });
      expect(testKey.update).toHaveBeenCalledWith({ isActive: false }, { transaction: expect.anything() });
      expect(response.body.message).toBe('API key revoked successfully');
      expect(response.body.isActive).toBe(false);
    });

    it('should return 404 for a non-existent key', async () => {
      ApiKey.findOne.mockResolvedValue(null);
      await request(app).post('/api/api-keys/999999/revoke').expect(404);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete an API key', async () => {
      // Mock that the destroy operation was successful (returns 1)
      ApiKey.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete(`/api/api-keys/${testKey.id}`)
        .expect(200);

      expect(ApiKey.destroy).toHaveBeenCalledWith({
        where: { id: testKey.id.toString(), UserId: testUser.id },
      });
      expect(response.body.message).toBe('API key deleted successfully');
    });

    it('should return 404 when deleting a non-existent key', async () => {
      // Mock that the destroy operation failed (returns 0)
      ApiKey.destroy.mockResolvedValue(0);
      await request(app).delete('/api/api-keys/999999').expect(404);
    });
  });
});
