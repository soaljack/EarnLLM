const request = require('supertest');
const stripe = require('stripe');
const app = require('../../app');
const { PricingPlan } = require('../../src/models');

// Mock external dependencies
jest.mock('stripe');
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('Billing Routes', () => {
  let testUser;
  let proPlan;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock data
    proPlan = { id: 2, name: 'Pro', stripePriceId: 'price_pro_123' };
    testUser = {
      id: 1,
      email: 'billing-test@example.com',
      BillingAccount: { stripeCustomerId: 'cus_mock_12345' },
      PricingPlan: { id: 1, name: 'Starter' },
    };

    // Mock implementations
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = testUser;
      next();
    });

    const mockSession = { id: 'cs_test_123', url: 'https://checkout.stripe.com/mock_url' };
    const mockPortalSession = { url: 'https://billing.stripe.com/mock_portal' };
    const mockPaymentIntent = { clientSecret: 'pi_mock_secret_123' };

    stripe.checkout = {
      sessions: {
        create: jest.fn().mockResolvedValue(mockSession),
      },
    };
    stripe.billingPortal = {
      sessions: {
        create: jest.fn().mockResolvedValue(mockPortalSession),
      },
    };
    stripe.paymentIntents = {
      create: jest.fn().mockResolvedValue(mockPaymentIntent),
    };
  });

  describe('GET /api/billing/plans', () => {
    it('should list available pricing plans', async () => {
      PricingPlan.findAll.mockResolvedValue([proPlan]);
      const response = await request(app).get('/api/billing/plans').expect(200);
      expect(response.body[0].name).toBe('Pro');
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return user subscription details', async () => {
      const response = await request(app).get('/api/billing/subscription').expect(200);
      expect(response.body.currentPlan.name).toBe('Starter');
      expect(response.body.stripeCustomerId).toBe('cus_mock_12345');
    });
  });

  describe('POST /api/billing/checkout-session', () => {
    it('should create a checkout session', async () => {
      PricingPlan.findByPk.mockResolvedValue(proPlan);
      const response = await request(app)
        .post('/api/billing/checkout-session')
        .send({ planId: proPlan.id })
        .expect(200);

      expect(stripe.checkout.sessions.create).toHaveBeenCalled();
      expect(response.body.url).toBe('https://checkout.stripe.com/mock_url');
    });

    it('should return 400 for missing plan ID', async () => {
      await request(app).post('/api/billing/checkout-session').send({}).expect(400);
    });
  });

  describe('POST /api/billing/portal-session', () => {
    it('should create a customer portal session', async () => {
      const response = await request(app).post('/api/billing/portal-session').expect(200);
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalled();
      expect(response.body.url).toBe('https://billing.stripe.com/mock_portal');
    });
  });

  describe('POST /api/billing/add-credits', () => {
    it('should create a payment intent for credits', async () => {
      const response = await request(app)
        .post('/api/billing/add-credits')
        .send({ amountUsd: 50 })
        .expect(200);

      expect(stripe.paymentIntents.create).toHaveBeenCalled();
      expect(response.body.clientSecret).toBe('pi_mock_secret_123');
    });

    it('should return 400 for invalid amount', async () => {
      await request(app)
        .post('/api/billing/add-credits')
        .send({ amountUsd: 2 })
        .expect(400);
    });
  });
});
