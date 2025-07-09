jest.mock('sequelize', () => jest.requireActual('sequelize'));

require('dotenv').config();

/**
 * Global test setup for EarnLLM API tests
 */
const redisMock = require('redis-mock');
const { mockAuthenticateJWT, mockAuthenticateApiKey } = require('./mocks/auth.middleware.mock');
const authHelpersMock = require('./mocks/authHelpers.mock');
const { connectRateLimiter, closeRateLimiter } = require('../src/middleware/rateLimit.middleware');


// Mock the logger to suppress info/warn messages during tests
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(), // Keep error logging to see issues
  debug: jest.fn(),
}));

const { authenticateJWT, authenticateApiKey, requireAdmin } = require('../tests/mocks/auth.middleware.mock');

jest.mock('../src/middleware/jwt.middleware.js', () => ({
  authenticateJWT,
}));

jest.mock('../src/middleware/apiKey.middleware.js', () => ({
  authenticateApiKey,
}));

jest.mock('../src/middleware/admin.middleware.js', () => ({
  requireAdmin,
}));

jest.mock('../src/middleware/permission.middleware.js', () => ({
  requireApiPermission: () => (req, res, next) => next(),
}));

// Centralized mock for the rate limiter's Redis client
const mockRedisClient = redisMock.createClient();

// In-memory store for sorted sets used by the rate limiter mock
const sortedSets = {};

mockRedisClient.zAdd = jest.fn().mockImplementation(async (key, members) => {
  if (!sortedSets[key]) {
    sortedSets[key] = [];
  }
  const membersArray = Array.isArray(members) ? members : [members];
  membersArray.forEach(member => {
    sortedSets[key] = sortedSets[key].filter(m => m.value !== member.value);
    sortedSets[key].push(member);
  });
  return membersArray.length;
});

mockRedisClient.zCard = jest.fn().mockImplementation(async (key) => {
  return sortedSets[key] ? sortedSets[key].length : 0;
});

mockRedisClient.zRemRangeByScore = jest.fn().mockImplementation(async (key, min, max) => {
  if (!sortedSets[key]) {
    return 0;
  }
  const originalLength = sortedSets[key].length;
  sortedSets[key] = sortedSets[key].filter(m => m.score < min || m.score > max);
  return originalLength - sortedSets[key].length;
});

mockRedisClient.expire = jest.fn().mockResolvedValue(1);

// Mock the .multi() and .exec() for transactions
mockRedisClient.multi = jest.fn(() => {
  const multi = {
    zRemRangeByScore: jest.fn().mockReturnThis(),
    zAdd: jest.fn().mockReturnThis(),
    zCard: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      0, // zRemRangeByScore result
      1, // zAdd result
      1, // zCard result
      1, // expire result
    ]),
  };
  return multi;
});

module.exports = { mockRedisClient };



jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_mock123456' }),
    update: jest.fn().mockResolvedValue({ id: 'cus_mock123456' }),
  },
  subscriptions: {
    create: jest.fn().mockResolvedValue({
      id: 'sub_mock123456',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'sub_mock123456',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: 'cs_mock123456',
        url: 'https://checkout.stripe.com/mock',
      }),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        url: 'https://billing.stripe.com/mock',
      }),
    },
  },
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_mock123456',
      client_secret: 'pi_mock123456_secret_mock123456',
    }),
  },
  webhooks: {
    constructEvent: jest.fn().mockImplementation((_body, _signature, _secret) => ({
      type: 'mock.event',
      data: { object: {} },
    })),
  },
})));

// Mock OpenAI API
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          id: 'chatcmpl-mock123456',
          choices: [{ message: { role: 'assistant', content: 'This is a test response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      },
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
        usage: { prompt_tokens: 8, total_tokens: 8 },
      }),
    },
  })),
}));

// Mock authentication helpers
jest.doMock('../src/utils/auth', () => authHelpersMock, { virtual: true });

// Mock bcryptjs to avoid issues with native addons in tests
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockImplementation(async (plainPassword, _salt) => `${plainPassword}_hashed`),
  compare: jest.fn().mockImplementation(async (plainPassword, hashedPassword) => `${plainPassword}_hashed` === hashedPassword),
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);


