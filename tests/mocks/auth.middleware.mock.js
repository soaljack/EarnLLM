// Define a standard mock user, billing account, and pricing plan for authenticated routes
const mockBillingAccount = {
  id: 'b_act_123',
  UserId: 1,
  stripeCustomerId: 'cus_mock123',
  stripeSubscriptionId: 'sub_mock123',
  subscriptionStatus: 'active',
  credits: 1000,
  planName: 'Free Tier',
  renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function updateBillingAccount(values) {
    Object.assign(this, values);
    return Promise.resolve(this);
  }),
  toJSON: jest.fn().mockImplementation(function toJSONBillingAccount() { return { ...this }; }),
};

const mockFreeTierPlan = {
  id: 1,
  name: 'Free Tier',
  code: 'FREE',
  monthlyFee: 0,
  maxRequests: 1000,
  features: ['Basic API Access', 'Limited Support'],
  isPublic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function updateFreeTierPlan(values) {
    Object.assign(this, values);
    return Promise.resolve(this);
  }),
  toJSON: jest.fn().mockImplementation(function toJSONFreeTierPlan() { return { ...this }; }),
};

const mockUser = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  isActive: true,
  isAdmin: false,
  companyName: 'Test Inc.',
  lastLoginAt: new Date(),
  PricingPlanId: mockFreeTierPlan.id,
  BillingAccountId: mockBillingAccount.id,
  PricingPlan: mockFreeTierPlan,
  BillingAccount: mockBillingAccount,
  update: jest.fn().mockImplementation(function update(values) {
    Object.assign(this, values);
    // Simulate password hashing if password is being updated
    if (values.password) this.password = `hashed_${values.password}`;
    return Promise.resolve(this);
  }),
  validatePassword: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockImplementation(function toJSON() {
    const userCopy = { ...this };
    delete userCopy.password;
    return userCopy;
  }),
  getApiKeys: jest.fn().mockResolvedValue([]),
  createApiKey: jest.fn().mockResolvedValue({
    id: 'new_api_key', key: 'sk-mocknewapikey', prefix: 'mocknew', name: 'New Key',
  }),
};

const authenticateJWT = (req, res, next) => {
  // Simulate token verification if needed, or just assume valid for mock
  // For simplicity, we'll just attach the mockUser
  req.user = mockUser;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    const err = new Error('Admin access required');
    err.status = 403;
    next(err);
  }
};

const mockApiKey = {
  id: 'api_key_123',
  UserId: 1,
  prefix: 'sk-test',
  isActive: true,
  permissions: ['chat:completion', 'embed', 'moderation'],
  lastUsedAt: null,
  expiresAt: null,
  verify: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockImplementation(function toJSONApiKey() { return { ...this }; }),
};

const authenticateApiKey = (req, res, next) => {
  req.user = mockUser;
  req.apiKey = mockApiKey;
  next();
};

module.exports = {
  authenticateJWT,
  authenticateApiKey,
  requireAdmin,
  // Export mock objects if they need to be referenced/modified by tests
  mockUser,
  mockApiKey,
  mockFreeTierPlan,
  mockBillingAccount,
};
