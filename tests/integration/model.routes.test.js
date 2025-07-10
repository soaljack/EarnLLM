// Mock dependencies first to ensure they are applied before any other imports
jest.mock('../../src/middleware/apiKey.middleware');
jest.mock('../../src/middleware/jwt.middleware');
jest.mock('../../src/middleware/admin.middleware');

jest.mock('../../src/models', () => ({
  LlmModel: {
    findAll: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  ExternalModel: {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));

const { startServer, stopServer } = require('./helpers');
const { authenticateApiKey } = require('../../src/middleware/apiKey.middleware');
const { authenticateJWT } = require('../../src/middleware/jwt.middleware');
const { requireAdmin } = require('../../src/middleware/admin.middleware');
const { LlmModel, ExternalModel } = require('../../src/models');

describe('Model Routes', () => {
  let request;

  beforeAll(async () => {
    request = await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });
  let testUser;
  let adminUser;
  let systemModel;
  let externalModel;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock data
    testUser = {
      id: 1,
      email: 'model-routes-test@example.com',
      role: 'user',
      getPricingPlan: jest.fn().mockResolvedValue({
        id: 1, name: 'Starter', code: 'starter', allowBYOM: true, allowCustomModels: true,
      }),
    };

    adminUser = {
      id: 2,
      email: 'admin@example.com',
      role: 'admin',
      getPricingPlan: jest.fn().mockResolvedValue({ allowBYOM: true }),
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
      // Arrange
      authenticateApiKey.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
      LlmModel.findAll.mockResolvedValue([systemModel]);
      ExternalModel.findAll.mockResolvedValue([externalModel]);

      // Act
      const response = await request.get('/api/models');

      // Assert
      expect(response.status).toBe(200);
      expect(LlmModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true },
      }));
      expect(ExternalModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { UserId: testUser.id, isActive: true },
      }));
      expect(response.body.systemModels[0].name).toBe(systemModel.name);
      expect(response.body.externalModels[0].name).toBe(externalModel.name);
    });
  });

  describe('Admin: System Model Management', () => {
    beforeEach(() => {
      // For all admin tests, authenticate as admin and allow access
      authenticateJWT.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      requireAdmin.mockImplementation((req, res, next) => next());
    });

    it('POST /api/models - should create a new system model', async () => {
      // Arrange
      const newModelData = { name: 'New Test Model', provider: 'test', modelId: 'test-1' };
      LlmModel.create.mockResolvedValue({ id: 102, ...newModelData });

      // Act
      const response = await request.post('/api/models').send(newModelData).expect(201);

      // Assert
      expect(LlmModel.create).toHaveBeenCalledWith(expect.objectContaining(newModelData));
      expect(response.body.name).toBe(newModelData.name);
    });

    it('PUT /api/models/:id - should update a system model', async () => {
      // Arrange
      const mockModelInstance = {
        ...systemModel,
        update: jest.fn(function updateSystemModel(updates) {
          Object.assign(this, updates);
          return Promise.resolve(this);
        }),
      };
      LlmModel.findByPk.mockResolvedValue(mockModelInstance);

      // Act
      const response = await request
        .put(`/api/models/${systemModel.id}`)
        .send({ description: 'Updated description' })
        .expect(200);

      // Assert
      expect(LlmModel.findByPk).toHaveBeenCalledWith(systemModel.id.toString());
      expect(mockModelInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Updated description' }),
      );
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('User: External Model (BYOM) Management', () => {
    beforeEach(() => {
      // For all user BYOM tests, authenticate as a standard user
      authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
    });

    it('POST /api/models/external - should create a new external model if plan allows', async () => {
      // Arrange
      testUser.getPricingPlan.mockResolvedValue({ allowBYOM: true });
      const externalModelData = {
        name: 'My Custom Model',
        provider: 'custom',
        modelId: 'custom-123',
        apiKey: 'super-secret-key',
        apiEndpoint: 'https://api.custom.com/chat',
      };
      const mockCreatedModel = { ...externalModelData, id: 201, UserId: testUser.id };
      ExternalModel.create.mockResolvedValue(mockCreatedModel);

      // Act
      const response = await request.post('/api/models/external').send(externalModelData);

      // Assert
      expect(response.status).toBe(201);
      expect(ExternalModel.create).toHaveBeenCalledWith(expect.objectContaining({
        ...externalModelData,
        UserId: testUser.id,
      }));
      expect(response.body).toEqual(expect.objectContaining({ name: 'My Custom Model' }));
    });

    it('POST /api/models/external - should be forbidden if plan does not allow BYOM', async () => {
      // Arrange
      testUser.getPricingPlan.mockResolvedValue({ allowBYOM: false });
      const externalModelData = { name: 'test' };

      // Act
      const response = await request.post('/api/models/external').send(externalModelData);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Your plan does not support bringing your own models');
      expect(ExternalModel.create).not.toHaveBeenCalled();
    });

    it('PUT /api/models/external/:id - should update an external model', async () => {
      // Arrange
      const mockModelInstance = {
        ...externalModel,
        update: jest.fn(function updateExternalModel(updates) {
          Object.assign(this, updates);
          return Promise.resolve(this);
        }),
      };
      ExternalModel.findOne.mockResolvedValue(mockModelInstance);

      // Act
      const response = await request
        .put(`/api/models/external/${externalModel.id}`)
        .send({ name: 'An Updated Name' })
        .expect(200);

      // Assert
      expect(ExternalModel.findOne).toHaveBeenCalledWith({
        where: { id: externalModel.id.toString(), UserId: testUser.id },
      });
      expect(mockModelInstance.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'An Updated Name' }));
      expect(response.body.name).toBe('An Updated Name');
    });

    it('DELETE /api/models/external/:id - should delete an external model', async () => {
      // Arrange
      ExternalModel.destroy.mockResolvedValue(1);

      // Act
      await request.delete(`/api/models/external/${externalModel.id}`).expect(204);

      // Assert
      expect(ExternalModel.destroy).toHaveBeenCalledWith({
        where: { id: externalModel.id.toString(), UserId: testUser.id },
      });
    });

    it('should return 404 on DELETE if model is not found', async () => {
      // Arrange
      ExternalModel.destroy.mockResolvedValue(0);
      // Act & Assert
      await request.delete('/api/models/external/999').expect(404);
    });

    it("should not find another user's model to update", async () => {
      // Arrange
      ExternalModel.findOne.mockResolvedValue(null);

      // Act & Assert
      await request
        .put('/api/models/external/999')
        .send({ name: 'Attempted Update' })
        .expect(404);

      expect(ExternalModel.findOne).toHaveBeenCalledWith({ where: { id: '999', UserId: testUser.id } });
    });
  });
});
