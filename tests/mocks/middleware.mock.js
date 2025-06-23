// Mock for src/middleware/auth.middleware.js

// Default test user structure, similar to User.findByPk(1) in sequelize.mock.js.
const mockTestUser = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User1',
  role: 'user',
  isActive: true,
  BillingAccount: {
    id: 1,
    UserId: 1,
    PricingPlanId: 1,
    stripeSubscriptionStatus: 'active',
    PricingPlan: {
      id: 1,
      name: 'Free Tier',
      code: 'FREE',
      maxApiKeys: 1,
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      toJSON() { return { ...this }; },
    },
    toJSON() {
      const { PricingPlan, ...rest } = this;
      return { ...rest, PricingPlan: PricingPlan.toJSON ? PricingPlan.toJSON() : PricingPlan };
    },
  },
  toJSON() {
    const { BillingAccount, ...rest } = this;
    return {
      ...rest,
      BillingAccount: BillingAccount.toJSON ? BillingAccount.toJSON() : BillingAccount,
    };
  },
  validatePassword: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockImplementation(function update(newData) {
    Object.assign(this, newData);
    return Promise.resolve(this);
  }),
  getApiUsage: jest.fn().mockResolvedValue({ totalRequests: 0, tokensUsed: 0 }),
  canMakeRequest: jest.fn().mockResolvedValue({ canMakeRequest: true }),
};

const authenticateJWT = jest.fn((req, res, next) => {
  req.user = mockTestUser; // Set a default authenticated user
  // To allow specific tests to override, they can re-mock this or req.user directly
  // e.g., jest.spyOn(req, 'user', 'get').mockReturnValue(someOtherUser);
  next();
});

// We might need to mock other middleware functions if they cause issues in tests.
// For now, we mock authenticateJWT. A placeholder for authenticateApiKey is also
// provided, though it's usually tested via specific integration tests that set
// the x-api-key header.

const authenticateApiKey = jest.fn((req, res, next) => {
  // This is a very basic mock. Most API key tests will mock ApiKey and User models directly.
  // If a generic API key auth is needed for some higher-level tests, this can be expanded.
  // It's safer to assume that tests requiring API key auth will set up their own
  // specific model mocks
  // and thus the real authenticateApiKey middleware will run using those mocks.
  // If we set req.user here, it might conflict with tests that *do* expect the real API key flow.
  // For now, just call next() to avoid blocking. If tests fail due to missing req.user/req.apiKey,
  // they should mock the models (ApiKey.findOne, User.findByPk) appropriately.
  next();
});

const requireAdmin = jest.fn((req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true)) {
    next();
  } else {
    // Simulate a 403 Forbidden error
    const err = new Error('Admin access required');
    err.status = 403;
    next(err);
  }
});

module.exports = {
  authenticateJWT,
  authenticateApiKey, // Providing a basic pass-through mock
  requireAdmin,
  // requireApiPermission would also go here if needed
};
