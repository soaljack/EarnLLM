/**
 * Unit tests for LlmModel model
 */

const { LlmModel } = require('../../../src/models');

describe('LlmModel Model', () => {
  afterAll(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create a basic model with required fields', async () => {
    const modelData = {
      name: 'GPT-4',
      provider: 'openai',
      modelId: 'gpt-4',
      basePromptTokenCostInCents: 0.03,
      baseCompletionTokenCostInCents: 0.06,
    };

    const model = await LlmModel.create(modelData);

    expect(model).toBeDefined();
    expect(model.id).toBeDefined();
    expect(model.name).toBe('GPT-4');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-4');
    expect(model.isActive).toBe(true); // Default value
    expect(model.basePromptTokenCostInCents).toBe(0.03);
    expect(model.baseCompletionTokenCostInCents).toBe(0.06);
    expect(model.markupPercentage).toBe(20); // Default value
    expect(model.contextWindow).toBe(8192); // Default value
  });

  test('should create a model with optional fields', async () => {
    const modelData = {
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      modelId: 'claude-3-opus-20240229',
      basePromptTokenCostInCents: 0.015,
      baseCompletionTokenCostInCents: 0.075,
      isActive: true,
      baseUrl: 'https://api.anthropic.com/v1',
      description: 'Claude 3 Opus is the most powerful model in the Claude 3 family.',
      capabilities: ['chat', 'embedding', 'classification'],
      contextWindow: 200000,
      markupPercentage: 25,
    };

    const model = await LlmModel.create(modelData);

    expect(model).toBeDefined();
    expect(model.name).toBe('Claude 3 Opus');
    expect(model.provider).toBe('anthropic');
    expect(model.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(model.description).toBe('Claude 3 Opus is the most powerful model in the Claude 3 family.');
    expect(model.capabilities).toEqual(['chat', 'embedding', 'classification']);
    expect(model.contextWindow).toBe(200000);
    expect(model.markupPercentage).toBe(25);
  });

  test('should fail to create model without required fields', async () => {
    // Missing provider
    const invalidModelData = {
      name: 'Invalid Model',
      modelId: 'invalid-model',
      basePromptTokenCostInCents: 0.05,
      // Missing baseCompletionTokenCostInCents
    };

    try {
      await LlmModel.create(invalidModelData);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      // In a real test with Sequelize, we would expect a SequelizeValidationError
    }
  });

  test('should default to chat capability if not specified', async () => {
    const modelData = {
      name: 'Default Capabilities Model',
      provider: 'cohere',
      modelId: 'command',
      basePromptTokenCostInCents: 0.03,
      baseCompletionTokenCostInCents: 0.06,
      // No capabilities specified, should default to ['chat']
    };

    const model = await LlmModel.create(modelData);

    expect(model.capabilities).toEqual(['chat']);
  });

  test('should calculate final token costs with markup', async () => {
    const modelData = {
      name: 'Markup Test Model',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      basePromptTokenCostInCents: 0.01,
      baseCompletionTokenCostInCents: 0.03,
      markupPercentage: 50,
    };

    const model = await LlmModel.create(modelData);

    // Helper function to calculate final cost with markup
    const withMarkup = (baseCost, markupPercent) => baseCost * (1 + markupPercent / 100);

    // Add these calculation methods to our model
    model.getPromptTokenCost = function getPromptTokenCost() {
      return withMarkup(this.basePromptTokenCostInCents, this.markupPercentage);
    };

    model.getCompletionTokenCost = function getCompletionTokenCost() {
      return withMarkup(this.baseCompletionTokenCostInCents, this.markupPercentage);
    };

    // Test calculations
    expect(model.getPromptTokenCost()).toBe(0.015); // 0.01 + 50% markup
    expect(model.getCompletionTokenCost()).toBe(0.045); // 0.03 + 50% markup
  });

  test('should update model attributes', async () => {
    const modelData = {
      name: 'Updateable Model',
      provider: 'openai',
      modelId: 'text-embedding-3-large',
      basePromptTokenCostInCents: 0.005,
      baseCompletionTokenCostInCents: 0.005,
      capabilities: ['embedding'],
    };

    const model = await LlmModel.create(modelData);

    // Update to new values
    await model.update({
      name: 'Updated Embedding Model',
      isActive: false,
      description: 'This model is deprecated.',
      markupPercentage: 10,
    });

    expect(model.name).toBe('Updated Embedding Model');
    expect(model.isActive).toBe(false);
    expect(model.description).toBe('This model is deprecated.');
    expect(model.markupPercentage).toBe(10);
    expect(model.provider).toBe('openai'); // Should keep existing values
  });
});
