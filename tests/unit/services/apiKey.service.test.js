// Mock the models module first
jest.mock('../../../src/models', () => ({
  ApiKey: {
    findAll: jest.fn(),
    create: jest.fn(),
    generateKey: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

// Now require the modules
const apiKeyService = require('../../../src/services/apiKey.service');
const { ApiKey, sequelize } = require('../../../src/models');

describe('ApiKey Service', () => {
  let mockTransaction;

  beforeEach(() => {
    // Setup a mock transaction that can be awaited
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllApiKeysForUser', () => {
    it('should return all API keys for a user', async () => {
      const userId = 'a-valid-uuid';
      const mockKeys = [{ id: 'key-1' }, { id: 'key-2' }];
      ApiKey.findAll.mockResolvedValue(mockKeys);

      const result = await apiKeyService.getAllApiKeysForUser(userId);

      expect(ApiKey.findAll).toHaveBeenCalledWith({
        where: { UserId: userId },
        attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt', 'permissions', 'createdAt'],
      });
      expect(result).toEqual(mockKeys);
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key for a user', async () => {
      const userId = 'a-valid-uuid';
      const keyData = { name: 'Test Key' };
      const keyDetails = {
        prefix: 'sk-test',
        fullKey: 'sk-test-full-key',
        hashedKey: 'hashed-key',
      };
      const mockNewKey = { id: 'new-key-id', ...keyData, ...keyDetails };

      ApiKey.generateKey.mockReturnValue(keyDetails);
      ApiKey.create.mockResolvedValue(mockNewKey);

      const result = await apiKeyService.createApiKey(userId, keyData);

      expect(ApiKey.generateKey).toHaveBeenCalled();
      expect(ApiKey.create).toHaveBeenCalledWith({
        ...keyData,
        UserId: userId,
        prefix: keyDetails.prefix,
        key: keyDetails.hashedKey,
        permissions: ['chat:completion', 'embed'],
        expiresAt: null,
      }, { transaction: mockTransaction });
      expect(result.key).toBe(keyDetails.fullKey);
    });
  });

  describe('updateApiKeyById', () => {
    it('should update an API key', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-1';
      const updateData = { name: 'New Name' };
      const mockKey = { id: apiKeyId, name: 'Old Name', save: jest.fn() };

      ApiKey.findOne.mockResolvedValue(mockKey);

      await apiKeyService.updateApiKeyById(userId, apiKeyId, updateData);

      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { id: apiKeyId, UserId: userId }, transaction: mockTransaction });
      expect(mockKey.name).toBe(updateData.name);
      expect(mockKey.save).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    it('should throw an error if the key is not found', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-not-found';
      ApiKey.findOne.mockResolvedValue(null);

      await expect(apiKeyService.updateApiKeyById(userId, apiKeyId, {})).rejects.toThrow('API key not found');
    });
  });

  describe('revokeApiKeyById', () => {
    it('should revoke an API key', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-1';
      const mockKey = { id: apiKeyId, isActive: true, save: jest.fn() };
      ApiKey.findOne.mockResolvedValue(mockKey);

      await apiKeyService.revokeApiKeyById(userId, apiKeyId);

      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { id: apiKeyId, UserId: userId }, transaction: mockTransaction });
      expect(mockKey.isActive).toBe(false);
      expect(mockKey.save).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    it('should throw an error if the API key is not found', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-not-found';
      ApiKey.findOne.mockResolvedValue(null);

      await expect(apiKeyService.revokeApiKeyById(userId, apiKeyId)).rejects.toThrow('API key not found');
    });
  });

  describe('deleteApiKeyById', () => {
    it('should delete an API key', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-1';
      ApiKey.destroy.mockResolvedValue(1); // Indicates one row was deleted

      await apiKeyService.deleteApiKeyById(userId, apiKeyId);

      expect(ApiKey.destroy).toHaveBeenCalledWith({ where: { id: apiKeyId, UserId: userId }, transaction: mockTransaction });
    });

    it('should throw an error if the API key to delete is not found', async () => {
      const userId = 'a-valid-uuid';
      const apiKeyId = 'a-valid-uuid-key-not-found';
      ApiKey.destroy.mockResolvedValue(0); // Indicates no rows were deleted

      await expect(apiKeyService.deleteApiKeyById(userId, apiKeyId)).rejects.toThrow('API key not found');
    });
  });
});
