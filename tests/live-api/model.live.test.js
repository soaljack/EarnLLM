// These tests use the global 'testRequest' object initialized in jest.setup.live.js

describe('Model Live API Routes', () => {
  

  describe('GET /api/models', () => {
    test('should return a list of system and external models', async () => {
      const response = await global.testRequest
        .get('/api/models')
        .set('x-api-key', global.LIVE_TEST_API_FULL_KEY)
        .expect(200);

      expect(response.body).toHaveProperty('systemModels');
      expect(response.body).toHaveProperty('externalModels');
      expect(response.body.systemModels).toBeInstanceOf(Array);

      // Check for the seeded system model
      const gpt35 = response.body.systemModels.find((m) => m.modelId === 'gpt-3.5-turbo');
      expect(gpt35).toBeDefined();
      expect(gpt35.name).toBe('GPT-3.5 Turbo');
    });

    test('should return 401 for request without API key', async () => {
      await global.testRequest.get('/api/models').expect(401);
    });
  });

  describe('GET /api/models/:id', () => {
    test('should return a specific system model by ID', async () => {
      // First, get the ID of the seeded model
      const listResponse = await global.testRequest
        .get('/api/models')
        .set('x-api-key', global.LIVE_TEST_API_FULL_KEY);
      const gpt35 = listResponse.body.systemModels.find((m) => m.modelId === 'gpt-3.5-turbo');
      const { id } = gpt35;

      const response = await global.testRequest
        .get(`/api/models/${id}`)
        .set('x-api-key', global.LIVE_TEST_API_FULL_KEY)
        .expect(200);

      expect(response.body).toHaveProperty('id', id);
      expect(response.body).toHaveProperty('modelId', 'gpt-3.5-turbo');
      expect(response.body).toHaveProperty('name', 'GPT-3.5 Turbo');
    });

    test('should return 404 for a non-existent model ID', async () => {
      await global.testRequest
        .get('/api/models/999999')
        .set('x-api-key', global.LIVE_TEST_API_FULL_KEY)
        .expect(404);
    });
  });
});
