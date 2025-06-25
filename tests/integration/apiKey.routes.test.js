// Mock dependencies first to ensure they are applied before any other imports
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn(),
  requireAdmin: jest.fn(),
  authenticateApiKey: jest.fn(),
}));

jest.mock('../../src/models', () => ({
  ApiKey: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
    generateKey: jest.fn(() => ({
      prefix: 'sk-test-mock',
      fullKey: 'sk-test-mock-key-string',
      hashedKey: 'hashed-mock-key',
    })),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../app');
const authMiddleware = require('../../src/middleware/auth.middleware');
const { ApiKey, sequelize } = require('../../src/models');

describe('API Key Routes', () => {
  let testUser;
  let testKey;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Mock Data Setup ---
    testUser = { id: 1, email: 'apikey-test@example.com' };
    testKey = {
      id: 101,
      name: 'My Test Key',
      UserId: testUser.id,
      isActive: true,
      // Simulate a Sequelize instance method
      update: jest.fn(async function update(data) {
        Object.assign(this, data);
        return this;
      }),
    };

    // --- Mock Implementation Setup ---
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      // Arrange
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

      // Act
      const response = await request(app)
        .post('/api/api-keys')
        .send({ name: keyName })
        .expect(201);

      // Assert
      expect(ApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: keyName, UserId: testUser.id })
      );
      expect(response.body).toHaveProperty('key');
      expect(response.body.key).toBe('sk-test-mock-key-string');
      expect(response.body.name).toBe(keyName);
    });

    it('should return 400 if name is missing', async () => {
      // Act & Assert
      await request(app).post('/api/api-keys').send({}).expect(400);
      expect(ApiKey.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/api-keys', () => {
    it("should list the user's API keys", async () => {
      // Arrange
      ApiKey.findAll.mockResolvedValue([testKey]);

      // Act
      const response = await request(app).get('/api/api-keys').expect(200);

      // Assert
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
      // Arrange
      const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
      sequelize.transaction.mockResolvedValue(mockTransaction);
      ApiKey.findOne.mockResolvedValue(testKey);

      // Act
      const response = await request(app)
        .post(`/api/api-keys/${testKey.id}/revoke`)
        .expect(200);

      // Assert
      expect(sequelize.transaction).toHaveBeenCalled();
      expect(ApiKey.findOne).toHaveBeenCalledWith({
        where: { id: testKey.id.toString(), UserId: testUser.id },
        transaction: mockTransaction,
      });
      expect(testKey.update).toHaveBeenCalledWith({ isActive: false }, { transaction: mockTransaction });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(response.body.message).toBe('API key revoked successfully');
    });

    it('should return 404 for a non-existent key', async () => {
      // Arrange
      ApiKey.findOne.mockResolvedValue(null);
      // Act & Assert
      await request(app).post('/api/api-keys/999999/revoke').expect(404);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete an API key', async () => {
      // Arrange
      ApiKey.destroy.mockResolvedValue(1);

      // Act
      const response = await request(app)
        .delete(`/api/api-keys/${testKey.id}`)
        .expect(200);

      // Assert
      expect(ApiKey.destroy).toHaveBeenCalledWith({
        where: { id: testKey.id.toString(), UserId: testUser.id },
      });
      expect(response.body.message).toBe('API key deleted successfully');
    });

    it('should return 404 when deleting a non-existent key', async () => {
      // Arrange
      ApiKey.destroy.mockResolvedValue(0);
      // Act & Assert
      await request(app).delete('/api/api-keys/999999').expect(404);
    });
  });
});
