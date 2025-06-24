const request = require('supertest');
// Hoist mocks to the top
jest.mock('../../src/middleware/auth.middleware');
jest.mock('../../src/models');

describe('Model Routes', () => {
  let app;
  let authMiddleware;
  let LlmModel;
  let ExternalModel;
  let testUser;
  let adminUser;
  let systemModel;
  let externalModel;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line global-require
    app = require('../../app');
    // eslint-disable-next-line global-require
    authMiddleware = require('../../src/middleware/auth.middleware');
    // eslint-disable-next-line global-require
    const models = require('../../src/models');
    LlmModel = models.LlmModel;
    ExternalModel = models.ExternalModel;

    jest.clearAllMocks();

    // Setup mock data
    testUser = {
      id: 1,
      email: 'model-routes-test@example.com',
      role: 'user',
      getPricingPlan: jest.fn().mockResolvedValue({
        allowBYOM: true,
        allowCustomModels: true,
      }),
      PricingPlan: { allowBYOM: true },
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
      // Setup mocks for this specific test
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        req.user = testUser;
        next();
      });
      LlmModel.findAll.mockResolvedValue([systemModel]);
      ExternalModel.findAll.mockResolvedValue([externalModel]);

      const response = await request(app).get('/api/models');
      expect(response.status).toBe(200);

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

      expect(LlmModel.create).toHaveBeenCalledWith(expect.objectContaining(newModelData));
      expect(response.body.name).toBe(newModelData.name);
    });

    it('PUT /api/models/:id - should update a system model', async () => {
      const mockModelInstance = {
        ...systemModel,
        update: jest.fn(function (updates) {
          Object.assign(this, updates);
          return Promise.resolve(this);
        }),
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

      const response = await request(app).post('/api/models/external').send(externalModelData);

      expect(response.status).toBe(201);
      expect(ExternalModel.create).toHaveBeenCalledWith({
        ...externalModelData, UserId: testUser.id,
      });
      expect(response.body).toEqual(expect.objectContaining({ name: 'My Custom Model' }));
    });

    it('POST /api/models/external - should be forbidden if plan does not allow BYOM', async () => {
      testUser.getPricingPlan.mockResolvedValue({ allowBYOM: false });

      const externalModelData = { name: 'test' };
      const response = await request(app).post('/api/models/external').send(externalModelData);
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Your current plan does not allow creating external models. Please upgrade your plan.');
      expect(ExternalModel.create).not.toHaveBeenCalled();
    });

    it('PUT /api/models/external/:id - should update an external model', async () => {
      const mockModelInstance = {
        ...externalModel,
        update: jest.fn(function (updates) {
          Object.assign(this, updates);
          return Promise.resolve(this);
        }),
      };
      ExternalModel.findOne.mockResolvedValue(mockModelInstance);

      const response = await request(app)
        .put(`/api/models/external/${externalModel.id}`)
        .send({ name: 'An Updated Name' })
        .expect(200);

      expect(ExternalModel.findOne).toHaveBeenCalledWith({
        where: { id: externalModel.id.toString(), UserId: testUser.id },
      });
      expect(mockModelInstance.update).toHaveBeenCalledWith({ name: 'An Updated Name' });
      expect(response.body.name).toBe('An Updated Name');
    });

    it('DELETE /api/models/external/:id - should delete an external model', async () => {
      ExternalModel.findOne.mockResolvedValue(externalModel);

      await request(app).delete(`/api/models/external/${externalModel.id}`).expect(204);

      expect(ExternalModel.destroy).toHaveBeenCalledWith({
        where: { id: externalModel.id.toString(), UserId: testUser.id },
      });
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
