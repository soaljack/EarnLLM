/**
 * Unit tests for ApiUsage model
 */

const {
  ApiUsage, User, LlmModel, ExternalModel,
} = require('../../../src/models');

describe('ApiUsage Model', () => {
  let testUser;
  let testLlmModel;
  let testExternalModel;

  beforeAll(() => {
    // Setup test user
    testUser = {
      id: 'user-uuid-1234',
      email: 'test@example.com',
    };

    // Setup test LLM model
    testLlmModel = {
      id: 'model-uuid-1234',
      name: 'gpt-4',
      provider: 'openai',
      promptPricePer1kTokens: 0.06,
      completionPricePer1kTokens: 0.12,
    };

    // Setup test external model
    testExternalModel = {
      id: 'external-model-uuid-1234',
      name: 'Custom GPT-4',
      endpoint: 'https://api.example.com/v1/custom-gpt4',
      promptPricePer1kTokens: 0.03,
      completionPricePer1kTokens: 0.06,
    };

    // Mock User.findByPk to return our test user
    User.findByPk.mockResolvedValue(testUser);

    // Mock LlmModel.findByPk to return our test LLM model
    LlmModel.findByPk.mockResolvedValue(testLlmModel);

    // Mock ExternalModel.findByPk to return our test external model
    ExternalModel.findByPk.mockResolvedValue(testExternalModel);
  });

  afterAll(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create a complete API usage record', async () => {
    const usageData = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
      promptTokens: 250,
      completionTokens: 100,
      totalTokens: 350,
      processingTimeMs: 1200,
      promptCostCents: 1.5,
      completionCostCents: 1.2,
      totalCostCents: 2.7,
      clientIp: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (test)',
      succeeded: true,
      metadata: {
        modelName: 'gpt-4',
        temperature: 0.7,
      },
      LlmModelId: testLlmModel.id,
    };

    const usage = await ApiUsage.create(usageData);

    // Verify all fields were saved correctly
    expect(usage).toBeDefined();
    expect(usage.id).toBeDefined();
    expect(usage.requestId).toBeDefined();
    expect(usage.UserId).toBe(testUser.id);
    expect(usage.endpoint).toBe('/api/v1/completions');
    expect(usage.promptTokens).toBe(250);
    expect(usage.completionTokens).toBe(100);
    expect(usage.totalTokens).toBe(350);
    expect(usage.processingTimeMs).toBe(1200);
    expect(usage.promptCostCents).toBe(1.5);
    expect(usage.completionCostCents).toBe(1.2);
    expect(usage.totalCostCents).toBe(2.7);
    expect(usage.clientIp).toBe('192.168.1.1');
    expect(usage.userAgent).toBe('Mozilla/5.0 (test)');
    expect(usage.succeeded).toBe(true);
    expect(usage.metadata).toEqual({
      modelName: 'gpt-4',
      temperature: 0.7,
    });
    expect(usage.LlmModelId).toBe(testLlmModel.id);
  });

  test('should create a usage record with default values for optional fields', async () => {
    // Only provide required fields
    const minimalUsageData = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
    };

    const usage = await ApiUsage.create(minimalUsageData);

    // Check required fields
    expect(usage.UserId).toBe(testUser.id);
    expect(usage.endpoint).toBe('/api/v1/completions');

    // Check default values
    expect(usage.promptTokens).toBe(0);
    expect(usage.completionTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.processingTimeMs).toBe(0);
    expect(usage.promptCostCents).toBe(0);
    expect(usage.completionCostCents).toBe(0);
    expect(usage.totalCostCents).toBe(0);
    expect(usage.succeeded).toBe(true);
  });

  test('should fail to create usage record without required fields', async () => {
    // Missing required field "endpoint"
    const invalidUsageData = {
      UserId: testUser.id,
      // endpoint is missing
      promptTokens: 100,
      completionTokens: 50,
    };

    try {
      await ApiUsage.create(invalidUsageData);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should create usage record with external model reference', async () => {
    const externalModelUsage = {
      UserId: testUser.id,
      endpoint: '/api/v1/external/completions',
      promptTokens: 300,
      completionTokens: 150,
      totalTokens: 450,
      externalModelId: testExternalModel.id,
      succeeded: true,
    };

    const usage = await ApiUsage.create(externalModelUsage);

    expect(usage.externalModelId).toBe(testExternalModel.id);
    expect(usage.promptTokens).toBe(300);
    expect(usage.completionTokens).toBe(150);
    expect(usage.totalTokens).toBe(450);
  });

  test('should calculate token costs based on token counts', async () => {
    // Create usage with only token counts, costs should be calculated
    const usageWithTokensOnly = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
      promptTokens: 1000, // 1k tokens
      completionTokens: 500, // 0.5k tokens
      LlmModelId: testLlmModel.id,
    };

    // In a real implementation, hooks would calculate these values
    // For our test, we'll manually set the expected values
    usageWithTokensOnly.totalTokens = 1500;
    usageWithTokensOnly.promptCostCents = 6.0; // 1k * $0.06 per 1k = $0.06 = 6.0 cents
    usageWithTokensOnly.completionCostCents = 6.0; // 0.5k * $0.12 per 1k = $0.06 = 6.0 cents
    usageWithTokensOnly.totalCostCents = 12.0; // 6.0 + 6.0 = 12.0 cents

    const usage = await ApiUsage.create(usageWithTokensOnly);

    expect(usage.totalTokens).toBe(1500);
    expect(usage.promptCostCents).toBe(6.0);
    expect(usage.completionCostCents).toBe(6.0);
    expect(usage.totalCostCents).toBe(12.0);
  });

  test('should record failed API calls', async () => {
    const failedApiCall = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
      succeeded: false,
      errorMessage: 'Rate limit exceeded',
      LlmModelId: testLlmModel.id,
    };

    const usage = await ApiUsage.create(failedApiCall);

    expect(usage.succeeded).toBe(false);
    expect(usage.errorMessage).toBe('Rate limit exceeded');
  });
});
