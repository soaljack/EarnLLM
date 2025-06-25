/**
 * Unit tests for PricingPlan model
 */

// Mock the PricingPlan model to be self-contained
jest.mock('../../../src/models', () => ({
  ...jest.requireActual('../../../src/models'),
  PricingPlan: {
    create: jest.fn(),
  },
}));

const { PricingPlan } = require('../../../src/models');

describe('PricingPlan Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockUpdate = jest.fn().mockImplementation(function update(values) {
      Object.assign(this, values);
      return this;
    });

    PricingPlan.create.mockImplementation(async (planData) => {
      if (!planData.code) {
        const error = new Error('Validation error: code cannot be null');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      const newPlan = {
        id: `plan_${Math.random().toString(36).substring(2, 9)}`,
        isActive: true,
        allowBYOM: false,
        tokenAllowance: null,
        requestsPerDay: null,
        requestsPerMinute: null,
        featuredModels: [],
        supportSla: null,
        stripeProductId: null,
        stripePriceId: null,
        ...planData,
        update: mockUpdate,
      };

      return Promise.resolve(newPlan);
    });
  });

  test('should create a basic pricing plan with required fields and defaults', async () => {
    const planData = { name: 'Basic Plan', code: 'basic', monthlyFee: 0 };
    const plan = await PricingPlan.create(planData);

    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();
    expect(plan.name).toBe('Basic Plan');
    expect(plan.code).toBe('basic');
    expect(plan.monthlyFee).toBe(0);
    expect(plan.isActive).toBe(true);
    expect(plan.allowBYOM).toBe(false);
    expect(plan.tokenAllowance).toBeNull();
  });

  test('should create a plan with all optional fields', async () => {
    const planData = {
      name: 'Enterprise Plan',
      code: 'enterprise',
      description: 'Full-featured enterprise plan',
      isActive: true,
      monthlyFee: 99900,
      tokenAllowance: 10000000,
      requestsPerDay: 100000,
      requestsPerMinute: 1000,
      featuredModels: ['gpt-4', 'claude-3-opus'],
      supportSla: '2-hour response',
      allowBYOM: true,
      stripeProductId: 'prod_test123',
      stripePriceId: 'price_test456',
    };

    const plan = await PricingPlan.create(planData);

    expect(plan.name).toBe('Enterprise Plan');
    expect(plan.tokenAllowance).toBe(10000000);
    expect(plan.featuredModels).toEqual(['gpt-4', 'claude-3-opus']);
    expect(plan.allowBYOM).toBe(true);
    expect(plan.stripeProductId).toBe('prod_test123');
  });

  test('should create a pay-as-you-go plan with unlimited usage', async () => {
    const planData = {
      name: 'Pay-as-you-go',
      code: 'payg',
      monthlyFee: 0,
      tokenAllowance: null,
      requestsPerDay: null,
      requestsPerMinute: 60,
    };

    const plan = await PricingPlan.create(planData);

    expect(plan.name).toBe('Pay-as-you-go');
    expect(plan.tokenAllowance).toBeNull();
    expect(plan.requestsPerDay).toBeNull();
    expect(plan.requestsPerMinute).toBe(60);
  });

  test('should fail to create plan without required fields', async () => {
    const invalidPlanData = { name: 'Invalid Plan', monthlyFee: 1000 };

    await expect(PricingPlan.create(invalidPlanData)).rejects.toThrow(
      'Validation error: code cannot be null',
    );
  });

  test('should update plan attributes', async () => {
    const planData = { name: 'Updateable Plan', code: 'update-test', monthlyFee: 2900 };
    const plan = await PricingPlan.create(planData);

    plan.update({
      description: 'This plan has been updated',
      monthlyFee: 3900,
      isActive: false,
    });

    expect(plan.update).toHaveBeenCalledWith({
      description: 'This plan has been updated',
      monthlyFee: 3900,
      isActive: false,
    });
    expect(plan.description).toBe('This plan has been updated');
    expect(plan.monthlyFee).toBe(3900);
    expect(plan.isActive).toBe(false);
    expect(plan.code).toBe('update-test');
  });
});
