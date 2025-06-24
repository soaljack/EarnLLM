/**
 * Mock Sequelize for testing
 */

const bcrypt = require('bcryptjs');

const mockModels = {
  User: {
    create: jest.fn().mockImplementation(async (userData) => {
      // Validate email format
      if (userData.email && !userData.email.includes('@')) {
        const error = new Error('Validation error: Invalid email format');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      // Hash password (hook simulation)
      // Use a fixed value that will match our test expectations
      const hashedPassword = 'hashedpassword123';
      if (userData.password) {
        // We'll still call bcrypt.hash so tests can check it was called
        await bcrypt.hash(userData.password, 10);
      }

      const user = {
        id: Math.floor(Math.random() * 1000),
        email: userData.email,
        firstName: userData.firstName || 'Test',
        lastName: userData.lastName || 'User',
        role: userData.role || 'user',
        // Set default values for fields
        isActive: true,
        isAdmin: false,
        companyName: userData.companyName || null,
        verifiedAt: null,
        lastLoginAt: null,
        ...userData, // Allow overrides from test data
        // Override password with hashed version
        password: hashedPassword,
        _lastUpdateValues: {}, // Store last update payload for 'changed' method

        // Add validatePassword instance method
        async validatePassword(submittedPassword) {
          console.log(`SEQUELIZE_MOCK_DEBUG: User.validatePassword called for user ${this.email} with submitted password: ${submittedPassword}`);
          console.log(`SEQUELIZE_MOCK_DEBUG: Expected password (from mock): ${this.password}`);
          return bcrypt.compare(submittedPassword, this.password);
        },

        // Add update instance method
        async update(values) {
          console.log(`SEQUELIZE_MOCK_DEBUG: User.update called for user ${this.email} with data:`, values);
          this._lastUpdateValues = { ...values }; // Store for 'changed' method
          const newValues = { ...values }; // Avoid reassigning parameter

          // Password hash hook simulation
          if (newValues.password) {
            // Call bcrypt.hash so tests can verify it's called
            await bcrypt.hash(newValues.password, 10);
            // But always use our test-expected value
            newValues.password = 'hashedpassword123';
          }

          Object.assign(this, newValues);
          return Promise.resolve(this);
        },

        // Mark which field was changed (for password rehashing hook)
        changed(field) {
          return field === 'password' && this._lastUpdateValues && this._lastUpdateValues.password;
        },
      };

      return Promise.resolve(user);
    }),
    findOne: jest.fn().mockImplementation(({ where }) => {
      // For auth tests - simulate finding user by email
      if (where && where.email) {
        if (where.email === 'test@example.com' || where.email === 'admin@earnllm.com') {
          return Promise.resolve({
            id: where.email === 'admin@earnllm.com' ? 999 : 1,
            email: where.email,
            firstName: 'Test',
            lastName: 'User',
            password: 'hashed_password',
            role: where.email === 'admin@earnllm.com' ? 'admin' : 'user',
            isActive: true,
          });
        }
        return Promise.resolve(null); // User not found
      }

      return Promise.resolve(null);
    }),
    findByPk: jest.fn().mockImplementation((id) => {
      if (id === 1) { // Specifically for the authenticateApiKey unit test's mockUser
        // This structure is copied from tests/unit/middleware/auth.middleware.fixed.test.js
        return Promise.resolve({
          id: 1,
          email: 'test@example.com',
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
              return {
                ...rest,
                PricingPlan: PricingPlan.toJSON ? PricingPlan.toJSON() : PricingPlan,
              };
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
        });
      }
      // Existing logic for other IDs (e.g., admin user, or generic users)
      if (id) { // If id is truthy (e.g. 1 will be caught above, 999 for admin, etc.)
        const userEmail = id === 999 ? 'admin@earnllm.com' : `testuser${id}@example.com`;
        const userRole = id === 999 ? 'admin' : 'user';

        const mockUserPricingPlan = {
          id: 1,
          name: 'Free Tier',
          code: 'FREE',
          monthlyFee: 0,
          maxApiKeys: 5,
          requestsPerMinute: 100,
          requestsPerDay: 1000,
          // Add any other fields your app uses from PricingPlan
          toJSON() { return { ...this }; },
        };

        const mockUserBillingAccount = {
          id, // Or a different ID, e.g., `billing_acc_${id}`
          UserId: id,
          PricingPlanId: mockUserPricingPlan.id,
          stripeSubscriptionStatus: 'active',
          balance: 0,
          // Add any other fields your app uses from BillingAccount
          PricingPlan: mockUserPricingPlan,
          toJSON() {
            const { PricingPlan, ...rest } = this;
            return {
              ...rest,
              PricingPlan: PricingPlan.toJSON ? PricingPlan.toJSON() : PricingPlan,
            };
          },
        };

        return Promise.resolve({
          id,
          email: userEmail,
          firstName: 'Test',
          lastName: `User${id}`,
          role: userRole,
          isActive: true,
          BillingAccount: mockUserBillingAccount,
          toJSON() {
            // Basic toJSON, ensure BillingAccount is also properly stringified
            // if it has its own toJSON.
            const { BillingAccount, ...rest } = this;
            return {
              ...rest,
              BillingAccount: BillingAccount.toJSON ? BillingAccount.toJSON() : BillingAccount,
            };
          },
          // It's good practice to include other commonly used instance methods
          // if they might be called on req.user. These can be simple jest.fn()
          // if their specific logic isn't critical for these auth tests.
          // Assuming password check isn't part of this flow
          validatePassword: jest.fn().mockResolvedValue(true),
          // 'this' refers to the user object
          update: jest.fn().mockImplementation(function update(newData) {
            Object.assign(this, newData);
            return Promise.resolve(this);
          }),
          getApiUsage: jest.fn().mockResolvedValue({ totalRequests: 0, tokensUsed: 0 }),
          canMakeRequest: jest.fn().mockResolvedValue({ canMakeRequest: true }),
          // Add any other methods that might be called on req.user in your controllers
        });
      }
      return Promise.resolve(null);
    }),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation(() => Promise.resolve([1])),
    destroy: jest.fn().mockResolvedValue(1),
    findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
  },
  ApiKey: {
    generateKey: jest.fn().mockReturnValue({
      prefix: 'sk-test-mockprefix',
      fullKey: 'sk-test-mockprefix_MOCKFULLKEYSTRING',
      hashedKey: 'mockHashedKey',
    }),
    create: jest.fn().mockImplementation(() => {
      const randomString = Math.random().toString(36).substring(2, 10);
      const prefix = `ek_${randomString}`;
      const rawKey = `${prefix}_${Math.random().toString(36).substring(2, 30)}`;

      return {
        id: Math.floor(Math.random() * 1000),
        // Use a proper hash that doesn't include the prefix (at least 32 chars like bcrypt)
        key: `$2b$10$${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        prefix,
        name: 'Test API Key',
        UserId: 1,
        isActive: true,
        rawKey, // Only available at creation time
        update: jest.fn().mockImplementation(function update(values) {
          Object.assign(this, values);
          return Promise.resolve(this);
        }),
      };
    }),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    destroy: jest.fn(),
    findByPk: jest.fn(),
    verifyKey: jest.fn().mockImplementation((key) => {
      // Simple mock implementation - considers keys valid if they start with 'ek_'
      // and don't contain 'INVALID' and aren't associated with inactive API keys
      if (!key || !key.startsWith('ek_') || key.includes('INVALID')) {
        return Promise.resolve(false);
      }

      // Track revoked keys so we can properly test revocation
      if (mockModels.ApiKey._revokedKeys && mockModels.ApiKey._revokedKeys.includes(key)) {
        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    }),
    _revokedKeys: [],
  },
  LlmModel: {
    create: jest.fn().mockImplementation((modelData) => {
      // Check required fields
      if (!modelData.name || !modelData.provider || !modelData.modelId
          || modelData.basePromptTokenCostInCents === undefined
          || modelData.baseCompletionTokenCostInCents === undefined) {
        const error = new Error('Validation error: Required fields missing');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      // Generate unique ID if not provided
      const id = modelData.id || `llm-${Math.random().toString(36).substring(2, 15)}`;

      // Create LLM model with defaults for optional fields
      const model = {
        id,
        name: modelData.name,
        provider: modelData.provider,
        modelId: modelData.modelId,
        isActive: modelData.isActive !== undefined ? modelData.isActive : true,
        baseUrl: modelData.baseUrl || null,
        description: modelData.description || null,
        capabilities: modelData.capabilities || ['chat'],
        basePromptTokenCostInCents: modelData.basePromptTokenCostInCents,
        baseCompletionTokenCostInCents: modelData.baseCompletionTokenCostInCents,
        contextWindow: modelData.contextWindow || 8192,
        markupPercentage: modelData.markupPercentage || 20,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Add update instance method
        async update(values) {
          // Update the properties
          Object.assign(this, values);
          this.updatedAt = new Date();

          return Promise.resolve(this);
        },
      };

      return Promise.resolve(model);
    }),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
    findByPk: jest.fn(),
  },
  PricingPlan: {
    create: jest.fn().mockImplementation((planData) => {
      // Check required fields
      if (!planData.name || !planData.code || planData.monthlyFee === undefined) {
        const error = new Error('Validation error: Required fields missing');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      // Generate unique ID if not provided
      const id = planData.id || `plan-${Math.random().toString(36).substring(2, 15)}`;

      // Create pricing plan with defaults for optional fields
      const plan = {
        id,
        name: planData.name,
        code: planData.code,
        description: planData.description || null,
        isActive: planData.isActive !== undefined ? planData.isActive : true,
        monthlyFee: planData.monthlyFee,
        tokenAllowance: planData.tokenAllowance || null,
        requestsPerDay: planData.requestsPerDay || null,
        requestsPerMinute: planData.requestsPerMinute || null,
        featuredModels: planData.featuredModels || null,
        supportSla: planData.supportSla || null,
        allowBYOM: planData.allowBYOM !== undefined ? planData.allowBYOM : false,
        stripeProductId: planData.stripeProductId || null,
        stripePriceId: planData.stripePriceId || null,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Add update instance method
        async update(values) {
          // Update the properties
          Object.assign(this, values);
          this.updatedAt = new Date();

          return Promise.resolve(this);
        },
      };

      return Promise.resolve(plan);
    }),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
    findByPk: jest.fn(),
  },
  BillingAccount: {
    create: jest.fn().mockImplementation((accountData) => {
      // Validate subscription status if provided
      if (accountData.subscriptionStatus
          && !['active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'trialing'].includes(accountData.subscriptionStatus)) {
        const error = new Error('Validation error: Invalid subscription status');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      // Generate unique ID if not provided
      const id = accountData.id || `billing-${Math.random().toString(36).substring(2, 15)}`;

      // Create billing account with defaults for optional fields
      const account = {
        id,
        UserId: accountData.UserId,
        stripeCustomerId: accountData.stripeCustomerId || null,
        stripeSubscriptionId: accountData.stripeSubscriptionId || null,
        subscriptionStatus: accountData.subscriptionStatus || null,
        currentPeriodStart: accountData.currentPeriodStart || null,
        currentPeriodEnd: accountData.currentPeriodEnd || null,
        creditBalance: accountData.creditBalance || 0,
        paymentMethod: accountData.paymentMethod || null,
        tokenUsageThisMonth: accountData.tokenUsageThisMonth || 0,
        billingEmail: accountData.billingEmail || null,
        invoiceSettings: accountData.invoiceSettings || null,
        paymentsEnabled:
          accountData.paymentsEnabled !== undefined
            ? accountData.paymentsEnabled
            : false,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Add instance methods
        async update(values) {
          // Validate subscription status if updating
          if (values.subscriptionStatus
              && !['active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'trialing'].includes(values.subscriptionStatus)) {
            const error = new Error('Validation error: Invalid subscription status');
            error.name = 'SequelizeValidationError';
            return Promise.reject(error);
          }

          // Update the properties
          Object.assign(this, values);
          this.updatedAt = new Date();

          return Promise.resolve(this);
        },
      };

      return Promise.resolve(account);
    }),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
  },
  ApiUsage: {
    create: jest.fn().mockImplementation((usageData) => {
      // Generate unique ID if not provided
      const id = usageData.id || `usage-${Math.random().toString(36).substring(2, 15)}`;

      // Generate unique request ID if not provided
      const requestId = usageData.requestId || `req-${Math.random().toString(36).substring(2, 15)}`;

      // Create usage record with defaults for optional fields
      return Promise.resolve({
        id,
        requestId,
        endpoint: usageData.endpoint,
        UserId: usageData.UserId,
        LlmModelId: usageData.LlmModelId || null,
        externalModelId: usageData.externalModelId || null,
        promptTokens: usageData.promptTokens || 0,
        completionTokens: usageData.completionTokens || 0,
        totalTokens: usageData.totalTokens || 0,
        processingTimeMs: usageData.processingTimeMs || 0,
        promptCostCents: usageData.promptCostCents || 0,
        completionCostCents: usageData.completionCostCents || 0,
        totalCostCents: usageData.totalCostCents || 0,
        clientIp: usageData.clientIp || null,
        userAgent: usageData.userAgent || null,
        succeeded: usageData.succeeded !== undefined ? usageData.succeeded : true,
        errorMessage: usageData.errorMessage || null,
        metadata: usageData.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    sum: jest.fn().mockResolvedValue(0),
    count: jest.fn().mockResolvedValue(0),
    findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    destroy: jest.fn().mockResolvedValue(1),
  },
  ExternalModel: {
    create: jest.fn().mockImplementation((modelData) => {
      // Check required fields
      if (!modelData.apiEndpoint || !modelData.apiKey) {
        const error = new Error('Validation error: Required fields missing');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      // Generate unique ID if not provided
      const id = modelData.id || `extmodel-${Math.random().toString(36).substring(2, 15)}`;

      // Create external model with defaults for optional fields
      const model = {
        id,
        UserId: modelData.UserId,
        name: modelData.name,
        provider: modelData.provider,
        modelId: modelData.modelId,
        apiEndpoint: modelData.apiEndpoint,
        apiKey: modelData.apiKey,
        isActive: modelData.isActive !== undefined ? modelData.isActive : true,
        capabilities: modelData.capabilities || ['chat'],
        promptTokenCostInCents: modelData.promptTokenCostInCents,
        completionTokenCostInCents: modelData.completionTokenCostInCents,
        contextWindow: modelData.contextWindow || 8192,
        requestTemplate: modelData.requestTemplate || null,
        responseMapping: modelData.responseMapping || null,
        headers: modelData.headers || {},
        lastTestedAt: modelData.lastTestedAt || null,
        testStatus: modelData.testStatus || 'untested',
        testMessage: modelData.testMessage || null,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Add the getDecryptedApiKey instance method
        getDecryptedApiKey() {
          return this.apiKey;
        },

        // Add update instance method
        async update(values) {
          // Update the properties
          Object.assign(this, values);
          this.updatedAt = new Date();

          return Promise.resolve(this);
        },
      };

      return Promise.resolve(model);
    }),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
    findByPk: jest.fn(),
  },
};

// Mock sequelize instance
const sequelizeMock = {
  authenticate: jest.fn().mockResolvedValue(true),
  sync: jest.fn().mockResolvedValue(true),
  transaction: jest.fn().mockImplementation((callback) => {
    if (callback) {
      const t = { commit: jest.fn(), rollback: jest.fn() };
      return callback(t);
    }
    return Promise.resolve({ commit: jest.fn(), rollback: jest.fn() });
  }),
  close: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue([]),
  define: jest.fn().mockReturnValue({}),
};

// Add model associations and reference the sequelize instance
Object.keys(mockModels).forEach((modelName) => {
  const model = mockModels[modelName];
  model.sequelize = sequelizeMock;
  model.findOrCreate = jest.fn();
  model.belongsTo = jest.fn();
  model.hasMany = jest.fn();
  model.hasOne = jest.fn();
  model.belongsToMany = jest.fn();
});

module.exports = {
  sequelize: sequelizeMock,
  Sequelize: {
    Op: {
      gt: Symbol('gt'),
      gte: Symbol('gte'),
      lt: Symbol('lt'),
      lte: Symbol('lte'),
      ne: Symbol('ne'),
      eq: Symbol('eq'),
      in: Symbol('in'),
      notIn: Symbol('notIn'),
      between: Symbol('between'),
      and: Symbol('and'),
      or: Symbol('or'),
      like: Symbol('like'),
      notLike: Symbol('notLike'),
    },
  },
  ...mockModels,
};
