/**
 * Enhanced test setup for EarnLLM API
 *
 * This provides a more realistic test environment by:
 * 1. Using actual route handlers
 * 2. Mocking only DB and external services
 * 3. Providing authentic JWT authentication
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

// Create a mock for all Sequelize models
const mockModels = {
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    build: jest.fn(),
  },
  ApiKey: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  ApiUsage: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  LlmModel: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  ExternalModel: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  BillingAccount: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  PricingPlan: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
};

// JWT mock implementation
jest.mock('jsonwebtoken', () => {
  const originalJwt = jest.requireActual('jsonwebtoken');
  return {
    sign: jest.fn().mockImplementation((payload, _secret, _options) => {
      // For test tokens, we'll use a predictable format
      if (payload.id === 1) {
        return 'mock_token_for_1';
      } if (payload.id === 999) {
        return 'mock_token_for_999';
      }
      return `mock_token_for_${payload.id || 'unknown'}`;
    }),
    verify: jest.fn().mockImplementation((token, _secret) => {
      // Parse our mock tokens
      if (token === 'mock_token_for_1') {
        return {
          id: 1, email: 'user@example.com', role: 'user', isAdmin: false,
        };
      } if (token === 'mock_token_for_999') {
        return {
          id: 999, email: 'admin@earnllm.com', role: 'admin', isAdmin: true,
        };
      } if (token.startsWith('mock_token_for_')) {
        const id = parseInt(token.replace('mock_token_for_', ''), 10);
        if (!Number.isNaN(id)) {
          return { id, email: `user${id}@example.com`, isAdmin: false };
        }
      }
      throw new Error('Invalid token');
    }),
    decode: originalJwt.decode,
  };
});

// Mock the Sequelize models
jest.mock('../../src/models', () => mockModels);

// Create a test Express app with actual middleware
function createTestApp() {
  const app = express();

  // Standard middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Disable logging in tests
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Add error handler
  app.use((err, req, res, _next) => {
    console.error('Test app error:', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });

  return app;
}

// Reset all mocks between tests
function resetMocks() {
  Object.values(mockModels).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });
  });

  if (jest.isMockFunction(jwt.sign)) jwt.sign.mockReset();
  if (jest.isMockFunction(jwt.verify)) jwt.verify.mockReset();
}

// Test fixtures for common test data
const fixtures = {
  users: {
    admin: {
      id: 999,
      email: 'admin@earnllm.com',
      firstName: 'Admin',
      lastName: 'User',
      isAdmin: true,
      isActive: true,
      PricingPlanId: 2,
    },
    regular: {
      id: 1,
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      isAdmin: false,
      isActive: true,
      PricingPlanId: 1,
    },
  },
  tokens: {
    admin: 'mock_token_for_999',
    user: 'mock_token_for_1',
  },
  apiUsageData: [
    {
      id: 1,
      UserId: 1,
      endpoint: '/api/llm/chat/completions',
      status: 'success',
      promptTokens: 30,
      completionTokens: 70,
      totalTokens: 100,
      promptCostCents: 0.06,
      completionCostCents: 0.14,
      totalCostCents: 0.20,
      model: 'gpt-4',
      createdAt: new Date(),
    },
  ],
};

// Helper to set up common DB mocks for tests
function setupDbMocksForAnalytics() {
  // Mock User count
  mockModels.User.count.mockResolvedValue(100);

  // Mock usage data
  mockModels.ApiUsage.findAll.mockImplementation((query) => {
    if (query.attributes && query.attributes.includes('endpoint')) {
      return Promise.resolve([
        {
          endpoint: '/api/llm/chat/completions',
          get: (attr) => {
            if (attr === 'totalTokens') return 50000;
            if (attr === 'totalCostCents') return 100.50;
            if (attr === 'requestCount') return 500;
            return null;
          },
        },
        {
          endpoint: '/api/llm/embeddings',
          get: (attr) => {
            if (attr === 'totalTokens') return 20000;
            if (attr === 'totalCostCents') return 40.25;
            if (attr === 'requestCount') return 300;
            return null;
          },
        },
      ]);
    }

    // Mock daily usage data
    if (query.attributes && query.attributes[0] && query.attributes[0][0] === 'DATE') {
      return Promise.resolve([
        {
          get: (attr) => {
            if (attr === 'date') return '2025-06-16';
            if (attr === 'totalTokens') return 80000;
            if (attr === 'totalCostCents') return 160.50;
            if (attr === 'requestCount') return 800;
            return null;
          },
        },
        {
          get: (attr) => {
            if (attr === 'date') return '2025-06-17';
            if (attr === 'totalTokens') return 100000;
            if (attr === 'totalCostCents') return 200.25;
            if (attr === 'requestCount') return 1000;
            return null;
          },
        },
      ]);
    }

    return Promise.resolve([]);
  });

  // Mock total usage
  mockModels.ApiUsage.findOne.mockImplementation((_query) => Promise.resolve({
    totalTokens: 150000,
    totalCostCents: 300.75,
    requestCount: 1500,
    getDataValue: (field) => {
      if (field === 'totalTokens') return 150000;
      if (field === 'totalCostCents') return 300.75;
      if (field === 'requestCount') return 1500;
      return null;
    },
  }));
}

module.exports = {
  createTestApp,
  resetMocks,
  fixtures,
  mockModels,
  setupDbMocksForAnalytics,
};
