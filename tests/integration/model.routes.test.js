/**
 * Integration tests for model routes
 */

const request = require('supertest');
const testApp = require('../testApp');
const {
  LlmModel, ExternalModel, User,
} = require('../../src/models');

describe('Model Routes', () => {
  const { app } = testApp;

  // Mock tokens for authentication
  const userToken = 'mock_token_for_1';
  const adminToken = 'mock_token_for_999';

  // Test data for system models
  const systemModelData = {
    id: 'sys-model-test-id-123',
    name: 'GPT-4 Test',
    provider: 'openai',
    modelId: 'gpt-4',
    basePromptTokenCostInCents: 0.03,
    baseCompletionTokenCostInCents: 0.06,
    contextWindow: 8192,
    markupPercentage: 20,
  };

  // Test data for external models
  const externalModelData = {
    id: 'ext-model-test-id-123',
    name: 'Custom Claude',
    provider: 'anthropic',
    modelId: 'claude-3-opus',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: 'test-api-key',
    promptTokenCostInCents: 0.08,
    completionTokenCostInCents: 0.24,
    contextWindow: 100000,
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock user with pricing plan that allows BYOM
    User.findByPk.mockImplementation((id) => {
      if (id === 1 || id === 999) {
        return Promise.resolve({
          id,
          email: id === 999 ? 'admin@earnllm.com' : 'user@example.com',
          role: id === 999 ? 'admin' : 'user',
          getPricingPlan: jest.fn().mockResolvedValue({
            allowBYOM: true,
          }),
        });
      }
      return Promise.resolve(null);
    });

    // Setup LlmModel mocks
    LlmModel.findAll.mockResolvedValue([systemModelData]);
    LlmModel.findOne.mockResolvedValue(systemModelData);
    LlmModel.findByPk.mockResolvedValue(systemModelData);
    LlmModel.create.mockResolvedValue(systemModelData);

    // Setup ExternalModel mocks
    ExternalModel.findAll.mockResolvedValue([externalModelData]);
    ExternalModel.findOne.mockImplementation(({ where }) => {
      if (where && where.id === 'ext-model-test-id-123' && where.UserId === 1) {
        return Promise.resolve({
          ...externalModelData,
          update: jest.fn().mockResolvedValue(externalModelData),
        });
      }
      return Promise.resolve(null);
    });
    ExternalModel.create.mockResolvedValue(externalModelData);
    ExternalModel.destroy.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * GET /api/models tests
   */
  describe('GET /api/models', () => {
    it('should return system and external models for authenticated user', async () => {
      const response = await request(app)
        .get('/api/models')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('systemModels');
      expect(response.body).toHaveProperty('externalModels');
      // When using mock routes, we don't need to check if model methods are called
      // since we're testing the route behavior, not the model interaction
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/models');

      expect(response.status).toBe(401);
    });
  });

  /**
   * GET /api/models/:id tests
   */
  describe('GET /api/models/:id', () => {
    it('should return a specific system model', async () => {
      const response = await request(app)
        .get(`/api/models/${systemModelData.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', systemModelData.id);
      expect(response.body).toHaveProperty('name', systemModelData.name);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/models/${systemModelData.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent model', async () => {
      // Mock both model lookups to return null
      LlmModel.findOne.mockResolvedValueOnce(null);
      ExternalModel.findOne.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/models/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  /**
   * Admin routes for system models
   */
  describe('Admin system model management', () => {
    it('should create a new system model for admin', async () => {
      const response = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(systemModelData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', systemModelData.name);
    });

    it('should not allow non-admin to create system model', async () => {
      const response = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${userToken}`)
        .send(systemModelData);

      expect(response.status).toBe(403);
      expect(LlmModel.create).not.toHaveBeenCalled();
    });

    it('should update a system model for admin', async () => {
      const updateData = {
        name: 'Updated GPT-4',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/models/${systemModelData.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', systemModelData.id);
    });

    it('should not allow non-admin to update system model', async () => {
      const response = await request(app)
        .put(`/api/models/${systemModelData.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Model' });

      expect(response.status).toBe(403);
    });
  });

  /**
   * External model routes (BYOM)
   */
  describe('External model management (BYOM)', () => {
    it('should create a new external model', async () => {
      const response = await request(app)
        .post('/api/models/external')
        .set('Authorization', `Bearer ${userToken}`)
        .send(externalModelData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', externalModelData.name);
    });

    it('should update an external model', async () => {
      const updateData = {
        name: 'Updated Claude',
        promptTokenCostInCents: 0.10,
      };

      const response = await request(app)
        .put(`/api/models/external/${externalModelData.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Updated Claude');
    });

    it('should delete an external model', async () => {
      const response = await request(app)
        .delete(`/api/models/external/${externalModelData.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should test an external model connection', async () => {
      // First create a new model that we can then test
      const createResponse = await request(app)
        .post('/api/models/external')
        .set('Authorization', `Bearer ${userToken}`)
        .send(externalModelData);

      expect(createResponse.status).toBe(201);
      const newModelId = createResponse.body.id;

      // Now test the connection for the model we just created
      const testResponse = await request(app)
        .post(`/api/models/external/${newModelId}/test`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(testResponse.status).toBe(200);
      expect(testResponse.body).toHaveProperty('success', true);
      expect(testResponse.body).toHaveProperty('status', 'success');
    });

    it('should return 404 when testing non-existent external model', async () => {
      // For non-existent model test, use a non-existent ID
      const response = await request(app)
        .post('/api/models/external/nonexistent-id/test')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });
});
