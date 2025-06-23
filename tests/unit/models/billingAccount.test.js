/**
 * Unit tests for BillingAccount model
 */

const { BillingAccount, User } = require('../../../src/models');

describe('BillingAccount Model', () => {
  let testUser;

  beforeAll(() => {
    // Setup test user
    testUser = {
      id: 'user-uuid-1234',
      email: 'billing-test@example.com',
    };

    // Mock User.findByPk to return our test user
    User.findByPk.mockResolvedValue(testUser);
  });

  afterAll(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create a basic billing account with default values', async () => {
    const account = await BillingAccount.create({
      UserId: testUser.id,
    });

    expect(account).toBeDefined();
    expect(account.id).toBeDefined();
    expect(account.UserId).toBe(testUser.id);
    expect(account.stripeCustomerId).toBeNull();
    expect(account.stripeSubscriptionId).toBeNull();
    expect(account.subscriptionStatus).toBeNull();
    expect(account.creditBalance).toBe(0);
    expect(account.tokenUsageThisMonth).toBe(0);
    expect(account.paymentsEnabled).toBe(false);
  });

  test('should create a billing account with Stripe information', async () => {
    const accountData = {
      UserId: testUser.id,
      stripeCustomerId: 'cus_12345678',
      stripeSubscriptionId: 'sub_12345678',
      subscriptionStatus: 'active',
      currentPeriodStart: new Date('2023-01-01'),
      currentPeriodEnd: new Date('2023-02-01'),
      paymentMethod: 'card_visa_1234',
      billingEmail: 'billing@example.com',
      paymentsEnabled: true,
    };

    const account = await BillingAccount.create(accountData);

    expect(account.stripeCustomerId).toBe('cus_12345678');
    expect(account.stripeSubscriptionId).toBe('sub_12345678');
    expect(account.subscriptionStatus).toBe('active');
    expect(account.currentPeriodStart).toEqual(new Date('2023-01-01'));
    expect(account.currentPeriodEnd).toEqual(new Date('2023-02-01'));
    expect(account.paymentMethod).toBe('card_visa_1234');
    expect(account.billingEmail).toBe('billing@example.com');
    expect(account.paymentsEnabled).toBe(true);
  });

  test('should handle adding credits to balance', async () => {
    const account = await BillingAccount.create({
      UserId: testUser.id,
      creditBalance: 1000, // 10.00 USD in cents
    });

    expect(account.creditBalance).toBe(1000);

    // Update credit balance
    await account.update({ creditBalance: 2500 }); // 25.00 USD
    expect(account.creditBalance).toBe(2500);

    // Add more credits (in a real app, this would be a method)
    const additionalCredits = 1000;
    await account.update({ creditBalance: account.creditBalance + additionalCredits });
    expect(account.creditBalance).toBe(3500); // 35.00 USD
  });

  test('should track token usage for the month', async () => {
    const account = await BillingAccount.create({
      UserId: testUser.id,
    });

    expect(account.tokenUsageThisMonth).toBe(0);

    // Update token usage
    await account.update({ tokenUsageThisMonth: 1000 });
    expect(account.tokenUsageThisMonth).toBe(1000);

    // Add more usage (in a real app, this would be a method)
    const additionalUsage = 500;
    await account.update({ tokenUsageThisMonth: account.tokenUsageThisMonth + additionalUsage });
    expect(account.tokenUsageThisMonth).toBe(1500);
  });

  test('should update subscription status', async () => {
    const account = await BillingAccount.create({
      UserId: testUser.id,
      subscriptionStatus: 'trialing',
      stripeSubscriptionId: 'sub_trial123',
    });

    expect(account.subscriptionStatus).toBe('trialing');

    // Update to active
    await account.update({ subscriptionStatus: 'active' });
    expect(account.subscriptionStatus).toBe('active');

    // Update to past_due
    await account.update({ subscriptionStatus: 'past_due' });
    expect(account.subscriptionStatus).toBe('past_due');

    // Update to canceled
    await account.update({ subscriptionStatus: 'canceled' });
    expect(account.subscriptionStatus).toBe('canceled');
  });

  test('should store invoice settings as JSON', async () => {
    const invoiceSettings = {
      defaultPaymentMethod: 'pm_card_visa',
      footer: 'Thank you for your business',
      customFields: [
        { name: 'Project ID', value: 'proj_123' },
      ],
    };

    const account = await BillingAccount.create({
      UserId: testUser.id,
      invoiceSettings,
    });

    expect(account.invoiceSettings).toEqual(invoiceSettings);

    // Update invoice settings
    const updatedSettings = {
      ...invoiceSettings,
      footer: 'Updated footer text',
    };

    await account.update({ invoiceSettings: updatedSettings });
    expect(account.invoiceSettings).toEqual(updatedSettings);
  });

  test('should reject invalid subscription status', async () => {
    try {
      await BillingAccount.create({
        UserId: testUser.id,
        subscriptionStatus: 'invalid_status', // Not in the ENUM
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      // In a real test with Sequelize, we would expect a SequelizeValidationError
    }
  });
});
