const { startServer, stopServer } = require('./helpers');

// Mock dependencies BEFORE requiring the app
const mStripe = {
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  paymentIntents: { create: jest.fn() },
};
jest.mock('stripe', () => jest.fn(() => mStripe));

jest.mock('../../src/middleware/jwt.middleware');
jest.mock('../../src/middleware/admin.middleware');
jest.mock('../../src/middleware/apiKey.middleware', () => ({
  authenticateApiKey: jest.fn(),
}));

const mockDb = {
  sequelize: {
    authenticate: jest.fn(() => Promise.resolve()),
    sync: jest.fn(() => Promise.resolve()),
  },
  Sequelize: { Op: {} },
  User: { findByPk: jest.fn() },
  PricingPlan: { findAll: jest.fn(), findByPk: jest.fn() },
  BillingAccount: { findOne: jest.fn() },
  ApiKey: {},
  LlmModel: {},
  ApiUsage: {},
  ExternalModel: {},
};
jest.mock('../../src/models', () => mockDb);

// Destructure models for easy access in tests
const { PricingPlan, BillingAccount } = mockDb;
const apiKeyMiddleware = require('../../src/middleware/apiKey.middleware');

// Mock logger to prevent hanging
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Billing Routes', () => {
  let request;

  beforeAll(async () => {
    request = await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });
  let testUser;
  let proPlan;
  let mockBillingAccount;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Mock Data Setup ---
    proPlan = {
      id: 2, name: 'Pro', stripePriceId: 'price_pro_123', isActive: true,
    };
    mockBillingAccount = {
      stripeCustomerId: 'cus_mock_12345',
      credits: 0,
      update: jest.fn(),
      toJSON: () => ({
        stripeCustomerId: 'cus_mock_12345',
        credits: 0,
      }),
    };
    mockBillingAccount.update.mockResolvedValue(mockBillingAccount);
    testUser = {
      id: 1,
      email: 'billing-test@example.com',
      getPricingPlan: jest.fn().mockResolvedValue({ name: 'Starter' }),
    };

    // --- Mock Implementations ---
    apiKeyMiddleware.authenticateApiKey.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });

    PricingPlan.findAll.mockResolvedValue([proPlan]);
    PricingPlan.findByPk.mockResolvedValue(proPlan);
    BillingAccount.findOne.mockResolvedValue(mockBillingAccount);

    // Mock Stripe SDK methods using the shared mock object
    mStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/mock_url',
    });
    mStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/mock_portal',
    });
    mStripe.paymentIntents.create.mockResolvedValue({
      client_secret: 'pi_mock_secret_123',
    });
  });

  describe('GET /api/billing/plans', () => {
    it('should list available pricing plans', async () => {
      const response = await request.get('/api/billing/plans').expect(200);
      expect(response.body[0].name).toBe('Pro');
      expect(PricingPlan.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return user subscription details', async () => {
      const response = await request.get('/api/billing/subscription').expect(200);
      expect(testUser.getPricingPlan).toHaveBeenCalled();
      expect(BillingAccount.findOne).toHaveBeenCalled();
      expect(response.body.currentPlan.name).toBe('Starter');
      expect(response.body.billingAccount.stripeCustomerId).toBe('cus_mock_12345');
    });
  });

  describe('POST /api/billing/checkout-session', () => {
    it('should create a checkout session for a new subscription', async () => {
      const response = await request
        .post('/api/billing/checkout-session')
        .send({ planId: proPlan.id })
        .expect(200);

      expect(PricingPlan.findByPk).toHaveBeenCalledWith(proPlan.id);
      expect(mStripe.checkout.sessions.create).toHaveBeenCalled();
      expect(response.body.url).toBe('https://checkout.stripe.com/mock_url');
    });
  });

  describe('POST /api/billing/portal-session', () => {
    it('should create a customer portal session', async () => {
      const response = await request.post('/api/billing/portal-session').expect(200);
      expect(BillingAccount.findOne).toHaveBeenCalled();
      expect(mStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_mock_12345',
        return_url: expect.any(String),
      });
      expect(response.body.url).toBe('https://billing.stripe.com/mock_portal');
    });
  });

  describe('POST /api/billing/add-credits', () => {
    it('should create a payment intent for adding credits', async () => {
      const response = await request
        .post('/api/billing/add-credits')
        .send({ amountUsd: 50 })
        .expect(200);

      expect(BillingAccount.findOne).toHaveBeenCalled();
      expect(mStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        customer: 'cus_mock_12345',
        metadata: {
          userId: testUser.id,
          amountUsd: 50,
        },
      });
      expect(response.body.clientSecret).toBe('pi_mock_secret_123');
    });
  });
});
