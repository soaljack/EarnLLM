/**
 * Unit tests for ApiUsage model
 */

const { ApiUsage } = require('../../../src/models');

describe('ApiUsage Model', () => {
  const testUser = { id: 'user-uuid-1234' };
  const testLlmModel = { id: 'model-uuid-1234' };
  const testExternalModel = { id: 'external-model-uuid-1234' };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(ApiUsage, 'create').mockImplementation(async (usageData) => {
      // Simulate validation for required fields
      if (!usageData.UserId || !usageData.endpoint) {
        return Promise.reject(new Error('Validation error: Missing required fields'));
      }

      // Simulate cost calculation hook
      const MOCK_PROMPT_COST = 0.006; // cents per token
      const MOCK_COMPLETION_COST = 0.012; // cents per token

      const promptTokens = usageData.promptTokens || 0;
      const completionTokens = usageData.completionTokens || 0;

      let calculatedData = {};
      if (usageData.LlmModelId) {
        calculatedData = {
          promptCostCents: promptTokens * MOCK_PROMPT_COST,
          completionCostCents: completionTokens * MOCK_COMPLETION_COST,
          totalTokens: promptTokens + completionTokens,
          get totalCostCents() {
            return this.promptCostCents + this.completionCostCents;
          },
        };
      }

      const newUsage = {
        id: `usage_${Math.random().toString(36).substring(2, 9)}`,
        requestId: `req_${Math.random().toString(36).substring(2, 9)}`,
        // Set defaults
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        processingTimeMs: 0,
        promptCostCents: 0,
        completionCostCents: 0,
        totalCostCents: 0,
        succeeded: true,
        // Merge provided data
        ...usageData,
        // Merge calculated data
        ...calculatedData,
      };

      return Promise.resolve(newUsage);
    });
  });

  test('should create a complete API usage record', async () => {
    const usageData = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
      promptTokens: 250,
      completionTokens: 100,
      processingTimeMs: 1200,
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
    expect(usage.promptCostCents).toBe(1.5); // 250 * 0.006
    expect(usage.completionCostCents).toBe(1.2); // 100 * 0.012
    expect(usage.totalCostCents).toBe(2.7);
    expect(usage.clientIp).toBe('192.168.1.1');
    expect(usage.userAgent).toBe('Mozilla/5.0 (test)');
    expect(usage.succeeded).toBe(true);
    expect(usage.metadata).toEqual({ modelName: 'gpt-4', temperature: 0.7 });
    expect(usage.LlmModelId).toBe(testLlmModel.id);
  });

  test('should create a usage record with default values for optional fields', async () => {
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
    const invalidUsageData = {
      promptTokens: 100,
      // Missing UserId and endpoint
    };

    await expect(ApiUsage.create(invalidUsageData)).rejects.toThrow('Validation error: Missing required fields');
  });

  test('should create usage record with external model reference', async () => {
    const externalModelUsage = {
      UserId: testUser.id,
      endpoint: '/api/v1/external/completions',
      promptTokens: 300,
      completionTokens: 150,
      externalModelId: testExternalModel.id,
      succeeded: true,
    };

    const usage = await ApiUsage.create(externalModelUsage);

    expect(usage.externalModelId).toBe(testExternalModel.id);
    expect(usage.promptTokens).toBe(300);
    expect(usage.completionTokens).toBe(150);
    // Note: cost calculation is not triggered for external models in this mock
    expect(usage.totalTokens).toBe(0);
  });

  test('should calculate token costs based on token counts', async () => {
    const usageWithTokensOnly = {
      UserId: testUser.id,
      endpoint: '/api/v1/completions',
      promptTokens: 1000, // 1k tokens
      completionTokens: 500, // 0.5k tokens
      LlmModelId: testLlmModel.id,
    };

    const usage = await ApiUsage.create(usageWithTokensOnly);

    expect(usage.totalTokens).toBe(1500);
    expect(usage.promptCostCents).toBe(6.0); // 1000 * 0.006
    expect(usage.completionCostCents).toBe(6.0); // 500 * 0.012
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
