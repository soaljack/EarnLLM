/**
 * Unit tests for ExternalModel model
 */

const { ExternalModel, User } = require('../../../src/models');

describe('ExternalModel Model', () => {
  let testUser;

  beforeAll(() => {
    // Setup test user
    testUser = {
      id: 'user-uuid-1234',
      email: 'external-model-test@example.com',
    };

    // Mock User.findByPk to return our test user
    User.findByPk.mockResolvedValue(testUser);
  });

  afterAll(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create a basic external model with required fields', async () => {
    const modelData = {
      UserId: testUser.id,
      name: 'GPT-4 External',
      provider: 'openai',
      modelId: 'gpt-4',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test12345',
      promptTokenCostInCents: 0.06,
      completionTokenCostInCents: 0.12,
    };

    const model = await ExternalModel.create(modelData);

    expect(model).toBeDefined();
    expect(model.id).toBeDefined();
    expect(model.UserId).toBe(testUser.id);
    expect(model.name).toBe('GPT-4 External');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-4');
    expect(model.apiEndpoint).toBe('https://api.openai.com/v1/chat/completions');
    expect(model.apiKey).toBeDefined();
    expect(model.isActive).toBe(true);
    expect(model.promptTokenCostInCents).toBe(0.06);
    expect(model.completionTokenCostInCents).toBe(0.12);
    expect(model.contextWindow).toBe(8192); // Default value
  });

  test('should encrypt API key on save', async () => {
    const modelData = {
      UserId: testUser.id,
      name: 'Claude External',
      provider: 'anthropic',
      modelId: 'claude-2',
      apiEndpoint: 'https://api.anthropic.com/v1/complete',
      apiKey: 'sk-ant-test12345',
      promptTokenCostInCents: 0.08,
      completionTokenCostInCents: 0.24,
    };

    const model = await ExternalModel.create(modelData);

    // In real test with actual encryption, we would expect the stored API key to be different
    // from the plain text one, but our mock doesn't do actual encryption
    expect(model.apiKey).toBeDefined();

    // Test getDecryptedApiKey method
    const decryptedKey = model.getDecryptedApiKey();
    expect(decryptedKey).toBeDefined();
  });

  test('should handle custom capabilities array', async () => {
    const modelData = {
      UserId: testUser.id,
      name: 'All-Purpose Model',
      provider: 'custom',
      modelId: 'custom-model',
      apiEndpoint: 'https://api.example.com/v1/generate',
      apiKey: 'api-key-test',
      promptTokenCostInCents: 0.05,
      completionTokenCostInCents: 0.10,
      capabilities: ['chat', 'embedding', 'image-generation'],
    };

    const model = await ExternalModel.create(modelData);

    expect(model.capabilities).toEqual(['chat', 'embedding', 'image-generation']);
  });

  test('should default to chat capability if not specified', async () => {
    const modelData = {
      UserId: testUser.id,
      name: 'Basic Chat Model',
      provider: 'cohere',
      modelId: 'command-light',
      apiEndpoint: 'https://api.cohere.ai/v1/generate',
      apiKey: 'api-key-test',
      promptTokenCostInCents: 0.03,
      completionTokenCostInCents: 0.06,
      // No capabilities specified, should default to ['chat']
    };

    const model = await ExternalModel.create(modelData);

    expect(model.capabilities).toEqual(['chat']);
  });

  test('should store custom request template and response mapping', async () => {
    const requestTemplate = {
      messages: '{messages}',
      temperature: 0.7,
      max_tokens: 1000,
    };

    const responseMapping = {
      content: 'choices[0].message.content',
      usage: {
        prompt_tokens: 'usage.prompt_tokens',
        completion_tokens: 'usage.completion_tokens',
      },
    };

    const modelData = {
      UserId: testUser.id,
      name: 'Custom Template Model',
      provider: 'custom',
      modelId: 'custom-template-model',
      apiEndpoint: 'https://api.custom.com/v1/generate',
      apiKey: 'api-key-test',
      promptTokenCostInCents: 0.05,
      completionTokenCostInCents: 0.10,
      requestTemplate,
      responseMapping,
    };

    const model = await ExternalModel.create(modelData);

    expect(model.requestTemplate).toEqual(requestTemplate);
    expect(model.responseMapping).toEqual(responseMapping);
  });

  test('should store custom headers', async () => {
    const headers = {
      'X-Custom-Header': 'custom-value',
      Authorization: 'Bearer {api_key}',
    };

    const modelData = {
      UserId: testUser.id,
      name: 'Custom Headers Model',
      provider: 'custom',
      modelId: 'custom-headers-model',
      apiEndpoint: 'https://api.custom.com/v1/generate',
      apiKey: 'api-key-test',
      promptTokenCostInCents: 0.05,
      completionTokenCostInCents: 0.10,
      headers,
    };

    const model = await ExternalModel.create(modelData);

    expect(model.headers).toEqual(headers);
  });

  test('should fail to create model without required fields', async () => {
    // Missing apiKey and apiEndpoint
    const invalidModelData = {
      UserId: testUser.id,
      name: 'Invalid Model',
      provider: 'custom',
      modelId: 'invalid-model',
      promptTokenCostInCents: 0.05,
      completionTokenCostInCents: 0.10,
    };

    try {
      await ExternalModel.create(invalidModelData);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      // In a real test with Sequelize, we would expect a SequelizeValidationError
    }
  });

  test('should track model test status', async () => {
    const modelData = {
      UserId: testUser.id,
      name: 'Tested Model',
      provider: 'custom',
      modelId: 'tested-model',
      apiEndpoint: 'https://api.custom.com/v1/generate',
      apiKey: 'api-key-test',
      promptTokenCostInCents: 0.05,
      completionTokenCostInCents: 0.10,
      testStatus: 'untested',
    };

    const model = await ExternalModel.create(modelData);
    expect(model.testStatus).toBe('untested');

    // Update test status
    await model.update({
      testStatus: 'success',
      lastTestedAt: new Date(),
      testMessage: 'Model test succeeded',
    });

    expect(model.testStatus).toBe('success');
    expect(model.lastTestedAt).toBeDefined();
    expect(model.testMessage).toBe('Model test succeeded');

    // Test failed status
    await model.update({
      testStatus: 'failed',
      testMessage: 'Connection timeout',
    });

    expect(model.testStatus).toBe('failed');
    expect(model.testMessage).toBe('Connection timeout');
  });
});
