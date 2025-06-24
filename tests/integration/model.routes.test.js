const request = require('supertest');
const app = require('../../app');
const { LlmModel, ExternalModel } = require('../../src/models');

// Mock the entire auth middleware module
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('Model Routes', () => {
  let testUser;
  let adminUser;
  let systemModel;
  let externalModel;

  beforeEach(() => {
    // Reset all mocks before each test to ensure isolation
    jest.clearAllMocks();

    // Setup mock data
    testUser = {
      id: 1,
      email: 'model-user@example.com',
      isAdmin: false,
      // Mock the user's pricing plan to allow BYOM
      PricingPlan: { allowBYOM: true },
    };

    adminUser = {
      id: 99,
      email: 'model-admin@example.com',
      isAdmin: true,
    };

    systemModel = {
      id: 101,
      name: 'GPT-4 Turbo',
      provider: 'openai',
      modelId: 'gpt-4-1106-preview',
    };

    externalModel = {
      id: 201,
      name: 'My Custom Model',
      UserId: testUser.id,
      provider: 'custom',
      destroy: jest.fn().mockResolvedValue(1),
    };
  });

  describe('GET /api/models', () => {
    it('should return system and user-specific external models', async () => {
      // Setup mocks for this specific test
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
      LlmModel.findAll.mockResolvedValue([systemModel]);
      ExternalModel.findAll.mockResolvedValue([externalModel]);

      const response = await request(app).get('/api/models').expect(200);

      expect(LlmModel.findAll).toHaveBeenCalled();
      expect(ExternalModel.findAll).toHaveBeenCalledWith({ where: { UserId: testUser.id } });
      expect(response.body.systemModels[0].name).toBe(systemModel.name);
      expect(response.body.externalModels[0].name).toBe(externalModel.name);
    });
  });

  describe('Admin: System Model Management', () => {
    beforeEach(() => {
      // For all admin tests, authenticate as admin and allow access
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      authMiddleware.requireAdmin.mockImplementation((req, res, next) => next());
    });

    it('POST /api/models - should create a new system model', async () => {
      const newModelData = { name: 'New Test Model', provider: 'test', modelId: 'test-1' };
      LlmModel.create.mockResolvedValue({ id: 102, ...newModelData });

      const response = await request(app).post('/api/models').send(newModelData).expect(201);

      expect(LlmModel.create).toHaveBeenCalledWith(newModelData);
      expect(response.body.name).toBe(newModelData.name);
    });

    it('PUT /api/models/:id - should update a system model', async () => {
      const updatedModel = { ...systemModel, description: 'Updated description' };
      const mockModelInstance = {
        ...systemModel,
        update: jest.fn().mockResolvedValue(updatedModel),
      };
      LlmModel.findByPk.mockResolvedValue(mockModelInstance);

      const response = await request(app)
        .put(`/api/models/${systemModel.id}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(LlmModel.findByPk).toHaveBeenCalledWith(systemModel.id.toString());
      expect(mockModelInstance.update).toHaveBeenCalledWith({ description: 'Updated description' });
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('User: External Model (BYOM) Management', () => {
    beforeEach(() => {
      // For all user BYOM tests, authenticate as a standard user
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
    });

    it('POST /api/models/external - should create a new external model if plan allows', async () => {
      const externalModelData = {
        name: 'My New Claude',
        provider: 'anthropic',
        modelId: 'claude-3-opus',
        apiKey: 'test-key',
      };
      ExternalModel.create.mockResolvedValue({ id: 202, ...externalModelData, UserId: testUser.id });

      const response = await request(app).post('/api/models/external').send(externalModelData).expect(201);

      expect(ExternalModel.create).toHaveBeenCalledWith({ ...externalModelData, UserId: testUser.id });
      expect(response.body.name).toBe(externalModelData.name);
    });

    it('POST /api/models/external - should be forbidden if plan does not allow BYOM', async () => {
      testUser.PricingPlan.allowBYOM = false;

      const externalModelData = { name: 'Forbidden Model', apiKey: 'key' };
      const response = await request(app).post('/api/models/external').send(externalModelData).expect(403);

      expect(response.body.message).toBe('Your current plan does not allow creating external models (BYOM).');
      expect(ExternalModel.create).not.toHaveBeenCalled();
    });

    it('PUT /api/models/external/:id - should update an external model', async () => {
      const updatedModel = { ...externalModel, name: 'An Updated Name' };
      const mockModelInstance = {
        ...externalModel,
        update: jest.fn().mockResolvedValue(updatedModel),
      };
      ExternalModel.findOne.mockResolvedValue(mockModelInstance);

      const response = await request(app)
        .put(`/api/models/external/${externalModel.id}`)
        .send({ name: 'An Updated Name' })
        .expect(200);

      expect(ExternalModel.findOne).toHaveBeenCalledWith({ where: { id: externalModel.id.toString(), UserId: testUser.id } });
      expect(mockModelInstance.update).toHaveBeenCalledWith({ name: 'An Updated Name' });
      expect(response.body.name).toBe('An Updated Name');
    });

    it('DELETE /api/models/external/:id - should delete an external model', async () => {
      ExternalModel.findOne.mockResolvedValue(externalModel);

      await request(app).delete(`/api/models/external/${externalModel.id}`).expect(204);

      expect(ExternalModel.findOne).toHaveBeenCalledWith({ where: { id: externalModel.id.toString(), UserId: testUser.id } });
      expect(externalModel.destroy).toHaveBeenCalled();
    });

    it("should not find another user's model to update", async () => {
      ExternalModel.findOne.mockResolvedValue(null);

      await request(app)
        .put('/api/models/external/999')
        .send({ name: 'Attempted Update' })
        .expect(404);

      expect(ExternalModel.findOne).toHaveBeenCalledWith({ where: { id: '999', UserId: testUser.id } });
    });
  });
});
