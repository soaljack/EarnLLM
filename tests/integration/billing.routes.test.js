/**
 * Integration tests for billing routes
 */

const request = require('supertest');
const app = require('../../app');
const { User, PricingPlan, BillingAccount } = require('../../src/models');
const authMiddleware = require('../../src/middleware/auth.middleware');

// Mock the entire auth middleware module to control authentication
jest.mock('../../src/middleware/auth.middleware');

const MOCK_STRIPE_PRICE_ID = 'price_mock_12345';

describe('Billing Routes', () => {
  let testUser;
  let freePlan;
  let proPlan;

  beforeAll(async () => {
    // Create pricing plans
    [freePlan, proPlan] = await Promise.all([
      PricingPlan.create({
        name: 'Starter',
        code: 'starter',
        description: 'Free tier with limited usage',
        monthlyFee: 0,
        tokenAllowance: 50000,
        requestsPerDay: 100,
        requestsPerMinute: 5,
        featuredModels: ['text-davinci-003'],
        supportSla: '72h',
        allowBYOM: false,
        stripePriceId: null,
        isActive: true,
      }),
      PricingPlan.create({
        name: 'Pro',
        code: 'pro',
        description: 'Pro tier with higher limits',
        monthlyFee: 49.99,
        tokenAllowance: 1000000,
        requestsPerDay: 10000,
        requestsPerMinute: 60,
        featuredModels: ['gpt-4', 'text-davinci-003'],
        supportSla: '24h',
        allowBYOM: true,
        stripePriceId: MOCK_STRIPE_PRICE_ID,
        isActive: true,
      }),
    ]);

    // Create test user
    testUser = await User.create({
      email: 'billing-test@example.com',
      password: 'Password123!',
      firstName: 'Billing',
      lastName: 'Tester',
      isActive: true,
      isAdmin: false,
      PricingPlanId: freePlan.id,
    });

    // Create billing account for the user
    await BillingAccount.create({
      UserId: testUser.id,
      stripeCustomerId: 'cus_mock_12345',
      creditBalance: 1000, // $10.00
      tokenUsageThisMonth: 25000,
      subscriptionStatus: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentMethod: 'card_visa_1234',
      billingEmail: 'billing-test@example.com',
      paymentsEnabled: true,
    });
  });

  beforeEach(() => {
    // Before each test, mock a successful authentication
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      User.findByPk(testUser.id, {
        include: [
          { model: PricingPlan, as: 'PricingPlan' },
          { model: BillingAccount, as: 'BillingAccount' },
        ],
      }).then(userWithAssocs => {
        req.user = userWithAssocs;
        next();
      }).catch(next);
    });
  });

  afterAll(async () => {
    await BillingAccount.destroy({ where: { UserId: testUser.id } });
    await User.destroy({ where: { email: 'billing-test@example.com' } });
    await PricingPlan.destroy({ where: { code: ['starter', 'pro'] } });
  });

  describe('GET /api/billing/plans', () => {
    test('should list available pricing plans', async () => {
      const response = await request(app).get('/api/billing/plans').expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(2);

      const free = response.body.find((plan) => plan.code === 'starter');
      expect(free).toBeDefined();
      expect(free).toHaveProperty('name', 'Starter');

      const pro = response.body.find((plan) => plan.code === 'pro');
      expect(pro).toBeDefined();
      expect(pro).toHaveProperty('name', 'Pro');
    });

    test('should require authentication', async () => {
      // Override mock to simulate auth failure for this test only
      authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });
      await request(app).get('/api/billing/plans').expect(401);
    });
  });

  describe('GET /api/billing/subscription', () => {
    test('should return user subscription details', async () => {
      const response = await request(app).get('/api/billing/subscription').expect(200);

      expect(response.body).toHaveProperty('currentPlan.name', 'Starter');
      expect(response.body).toHaveProperty('subscription.status', 'active');
      expect(response.body).toHaveProperty('usage.tokenUsageThisMonth', 25000);
      expect(response.body).toHaveProperty('stripeCustomerId', 'cus_mock_12345');
    });
  });

  describe('POST /api/billing/checkout-session', () => {
    test('should create a checkout session', async () => {
      const response = await request(app)
        .post('/api/billing/checkout-session')
        .send({ planId: proPlan.id })
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('url');
    });

    test('should return 400 for missing plan ID', async () => {
      await request(app).post('/api/billing/checkout-session').send({}).expect(400);
    });
  });

  describe('POST /api/billing/portal-session', () => {
    test('should create a customer portal session', async () => {
      const response = await request(app).post('/api/billing/portal-session').expect(200);
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('POST /api/billing/add-credits', () => {
    test('should create a payment intent for credits', async () => {
      const response = await request(app)
        .post('/api/billing/add-credits')
        .send({ amountUsd: 50 })
        .expect(200);

      expect(response.body).toHaveProperty('clientSecret');
    });

    test('should return 400 for invalid amount', async () => {
      await request(app)
        .post('/api/billing/add-credits')
        .send({ amountUsd: 2 }) // Below minimum
        .expect(400);
    });
  });
});
