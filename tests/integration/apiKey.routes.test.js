const request = require('supertest');
const app = require('../../app');
const { ApiKey } = require('../../src/models');

// Mock the entire auth middleware module
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('API Key Routes', () => {
  let testUser;
  let testKey;

  beforeEach(() => {
    jest.clearAllMocks();

    testUser = { id: 1, email: 'apikey-test@example.com' };

    // Mock an existing API key for the user
    testKey = {
      id: 101,
      name: 'My Test Key',
      UserId: testUser.id,
      isActive: true,
      save: jest.fn().mockReturnThis(),
      destroy: jest.fn().mockResolvedValue(1),
    };

    // Authenticate all requests with the test user
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      const keyName = 'My New Test Key';
      // The create method is static on the model, so we mock it here
      ApiKey.create.mockResolvedValue({ name: keyName, UserId: testUser.id });

      const response = await request(app)
        .post('/api/api-keys')
        .send({ name: keyName })
        .expect(201);

      expect(ApiKey.create).toHaveBeenCalledWith({ name: keyName, UserId: testUser.id });
      expect(response.body).toHaveProperty('key');
      expect(response.body.key).toMatch(/^sk-/);
      expect(response.body.message).toBe('API key created successfully.');
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

      expect(ApiKey.findAll).toHaveBeenCalledWith({ where: { UserId: testUser.id } });
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('My Test Key');
      expect(response.body[0]).not.toHaveProperty('hashedKey');
    });
  });

  describe('POST /api/api-keys/:id/revoke', () => {
    it('should revoke an active API key', async () => {
      ApiKey.findOne.mockResolvedValue(testKey);

      const response = await request(app)
        .post(`/api/api-keys/${testKey.id}/revoke`)
        .expect(200);

      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { id: testKey.id.toString(), UserId: testKey.UserId } });
      expect(testKey.save).toHaveBeenCalled();
      expect(response.body.message).toBe('API key revoked successfully.');
      expect(response.body.apiKey.isActive).toBe(false);
    });

    it('should return 404 for a non-existent key', async () => {
      ApiKey.findOne.mockResolvedValue(null);
      await request(app).post('/api/api-keys/999999/revoke').expect(404);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete an API key', async () => {
      ApiKey.findOne.mockResolvedValue(testKey);

      const response = await request(app)
        .delete(`/api/api-keys/${testKey.id}`)
        .expect(200);

      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { id: testKey.id.toString(), UserId: testUser.id } });
      expect(testKey.destroy).toHaveBeenCalled();
      expect(response.body.message).toBe('API key deleted successfully.');
    });

    it('should return 404 when deleting a non-existent key', async () => {
      ApiKey.findOne.mockResolvedValue(null);
      await request(app).delete('/api/api-keys/999999').expect(404);
    });
  });
});
