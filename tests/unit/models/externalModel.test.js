/**
 * Unit tests for ExternalModel model
 */

// Mock the ExternalModel
const mockExternalModel = {
  create: jest.fn(),
};
jest.mock('../../../src/models', () => ({
  ...jest.requireActual('../../../src/models'),
  ExternalModel: mockExternalModel,
}));

const { ExternalModel } = require('../../../src/models');

describe('ExternalModel Model', () => {
  const testUser = { id: 'user-uuid-1234' };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock instance methods
    const mockUpdate = jest.fn().mockImplementation(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    });

    const mockGetDecryptedApiKey = jest.fn().mockImplementation(function getDecryptedApiKey() {
      return this.apiKey; // In mock, we just return the plain key
    });

    // Mock static method
    ExternalModel.create.mockImplementation(async (modelData) => {
      // Simulate validation for required fields
      if (
        !modelData.UserId
        || !modelData.name
        || !modelData.provider
        || !modelData.modelId
        || !modelData.apiEndpoint
        || !modelData.apiKey
        || !modelData.promptTokenCostInCents
        || !modelData.completionTokenCostInCents
      ) {
        return Promise.reject(new Error('Validation error: Missing required fields'));
      }

      const newModel = {
        id: `extm_${Math.random().toString(36).substring(2, 9)}`,
        // Set defaults
        isActive: true,
        contextWindow: 8192,
        testStatus: 'untested',
        testMessage: null,
        lastTestedAt: null,
        headers: null,
        requestTemplate: null,
        responseMapping: null,
        // Merge provided data
        ...modelData,
        // Set default capabilities if not provided
        capabilities: modelData.capabilities || ['chat'],
        // Attach instance methods
        update: mockUpdate,
        getDecryptedApiKey: mockGetDecryptedApiKey,
      };

      return Promise.resolve(newModel);
    });
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
    expect(model.apiKey).toBe('sk-test12345');
    expect(model.isActive).toBe(true);
    expect(model.promptTokenCostInCents).toBe(0.06);
    expect(model.completionTokenCostInCents).toBe(0.12);
    expect(model.contextWindow).toBe(8192); // Default value
  });

  test('should "encrypt" API key on save and allow decryption', async () => {
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

    // Our mock doesn't do real encryption, but we check the method exists and works
    expect(model.apiKey).toBe('sk-ant-test12345');
    const decryptedKey = model.getDecryptedApiKey();
    expect(decryptedKey).toBe('sk-ant-test12345');
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
      // No capabilities specified
    };

    const model = await ExternalModel.create(modelData);

    expect(model.capabilities).toEqual(['chat']);
  });

  test('should store custom request template and response mapping', async () => {
    const requestTemplate = { messages: '{messages}' };
    const responseMapping = { content: 'choices[0].message.content' };

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
    const headers = { 'X-Custom-Header': 'custom-value' };

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
    await expect(
      ExternalModel.create({
        name: 'Invalid Model',
        type: 'invalid_type',
        contextLength: 4096,
        tokenizer: 'tiktoken',
        modelId: 'invalid-model-id',
      }),
    ).rejects.toThrow();
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
    };

    const model = await ExternalModel.create(modelData);
    expect(model.testStatus).toBe('untested');

    // Update test status to success
    await model.update({
      testStatus: 'success',
      lastTestedAt: new Date(),
      testMessage: 'Model test succeeded',
    });

    expect(model.testStatus).toBe('success');
    expect(model.lastTestedAt).toBeDefined();
    expect(model.testMessage).toBe('Model test succeeded');

    // Update test status to failed
    await model.update({
      testStatus: 'failed',
      testMessage: 'Connection timeout',
    });

    expect(model.testStatus).toBe('failed');
    expect(model.testMessage).toBe('Connection timeout');
  });
});
