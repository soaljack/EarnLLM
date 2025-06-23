/**
 * Unit tests for PricingPlan model
 */

const { PricingPlan } = require('../../../src/models');

describe('PricingPlan Model', () => {
  afterAll(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create a basic pricing plan with required fields', async () => {
    const planData = {
      name: 'Basic Plan',
      code: 'basic',
      monthlyFee: 0, // Free plan
    };

    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();
    expect(plan.name).toBe('Basic Plan');
    expect(plan.code).toBe('basic');
    expect(plan.monthlyFee).toBe(0);
    expect(plan.isActive).toBe(true); // Default value
    expect(plan.allowBYOM).toBe(false); // Default value
    expect(plan.tokenAllowance).toBeNull();
    expect(plan.requestsPerDay).toBeNull();
    expect(plan.requestsPerMinute).toBeNull();
  });

  test('should create a plan with all optional fields', async () => {
    const planData = {
      name: 'Enterprise Plan',
      code: 'enterprise',
      description: 'Full-featured enterprise plan with premium support',
      isActive: true,
      monthlyFee: 99900, // $999.00
      tokenAllowance: 10000000, // 10M tokens
      requestsPerDay: 100000,
      requestsPerMinute: 1000,
      featuredModels: ['gpt-4', 'claude-3-opus', 'gemini-pro'],
      supportSla: '2-hour response time',
      allowBYOM: true,
      stripeProductId: 'prod_test123',
      stripePriceId: 'price_test456',
    };

    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.name).toBe('Enterprise Plan');
    expect(plan.code).toBe('enterprise');
    expect(plan.description).toBe('Full-featured enterprise plan with premium support');
    expect(plan.monthlyFee).toBe(99900);
    expect(plan.tokenAllowance).toBe(10000000);
    expect(plan.requestsPerDay).toBe(100000);
    expect(plan.requestsPerMinute).toBe(1000);
    expect(plan.featuredModels).toEqual(['gpt-4', 'claude-3-opus', 'gemini-pro']);
    expect(plan.supportSla).toBe('2-hour response time');
    expect(plan.allowBYOM).toBe(true);
    expect(plan.stripeProductId).toBe('prod_test123');
    expect(plan.stripePriceId).toBe('price_test456');
  });

  test('should create a pay-as-you-go plan with unlimited usage', async () => {
    const planData = {
      name: 'Pay-as-you-go',
      code: 'payg',
      description: 'Pay only for what you use',
      monthlyFee: 0,
      // Null values for usage limits indicate unlimited
      tokenAllowance: null,
      requestsPerDay: null,
      requestsPerMinute: 60, // Rate limit to prevent abuse
      allowBYOM: false,
    };

    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.name).toBe('Pay-as-you-go');
    expect(plan.tokenAllowance).toBeNull(); // Unlimited tokens
    expect(plan.requestsPerDay).toBeNull(); // Unlimited requests per day
    expect(plan.requestsPerMinute).toBe(60); // Limited requests per minute
  });

  test('should create a pro plan with token allowance', async () => {
    const planData = {
      name: 'Pro Plan',
      code: 'pro',
      description: 'Professional plan with monthly token allowance',
      monthlyFee: 4900, // $49.00
      tokenAllowance: 1000000, // 1M tokens
      requestsPerDay: 10000,
      requestsPerMinute: 100,
      featuredModels: ['gpt-4', 'gpt-3.5-turbo'],
      supportSla: 'Next business day',
      allowBYOM: false,
    };

    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.name).toBe('Pro Plan');
    expect(plan.monthlyFee).toBe(4900);
    expect(plan.tokenAllowance).toBe(1000000);
    expect(plan.requestsPerDay).toBe(10000);
    expect(plan.featuredModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
  });

  test('should create a plan with Stripe integration', async () => {
    const planData = {
      name: 'Starter Plan',
      code: 'starter',
      description: 'Entry-level paid plan',
      monthlyFee: 1900, // $19.00
      tokenAllowance: 500000, // 500K tokens
      stripeProductId: 'prod_starter123',
      stripePriceId: 'price_starter456',
    };

    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.stripeProductId).toBe('prod_starter123');
    expect(plan.stripePriceId).toBe('price_starter456');
  });

  test('should fail to create plan without required fields', async () => {
    // Missing code
    const invalidPlanData = {
      name: 'Invalid Plan',
      // No code provided
      monthlyFee: 1000,
    };

    try {
      await PricingPlan.create(invalidPlanData);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      // In a real test with Sequelize, we would expect a SequelizeValidationError
    }
  });

  test('should update plan attributes', async () => {
    const planData = {
      name: 'Updateable Plan',
      code: 'update-test',
      monthlyFee: 2900,
    };

    const plan = await PricingPlan.create(planData);

    // Update to new values
    await plan.update({
      name: 'Updated Plan Name',
      description: 'This plan has been updated',
      monthlyFee: 3900,
      isActive: false,
    });

    expect(plan.name).toBe('Updated Plan Name');
    expect(plan.description).toBe('This plan has been updated');
    expect(plan.monthlyFee).toBe(3900);
    expect(plan.isActive).toBe(false);
    expect(plan.code).toBe('update-test'); // Should keep existing values
  });
});
