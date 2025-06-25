jest.mock('sequelize', () => jest.requireActual('sequelize'));

require('dotenv').config();

/**
 * Global test setup for EarnLLM API tests
 */
const redisMock = require('redis-mock');
const { mockAuthenticateJWT, mockAuthenticateApiKey } = require('./mocks/auth.middleware.mock');
const authHelpersMock = require('./mocks/authHelpers.mock');
const { sequelize } = require('../src/models');
const { connectRateLimiter, closeRateLimiter } = require('../src/middleware/rateLimit.middleware');

// Mock the logger to suppress info/warn messages during tests
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(), // Keep error logging to see issues
  debug: jest.fn(),
}));

jest.mock('../src/middleware/auth.middleware', () => ({
  authenticateJWT: mockAuthenticateJWT,
  authenticateApiKey: mockAuthenticateApiKey,
}));

// Centralized mock for the rate limiter's Redis client
const mockRedisClient = redisMock.createClient();

// Initialize rate limiter with mock client before any tests run
beforeAll(async () => {
  // Add properties needed by the application code to the mock client
  mockRedisClient.isReady = true;
  mockRedisClient.quit = jest.fn().mockResolvedValue('OK');
  mockRedisClient.connect = jest.fn().mockResolvedValue();
  mockRedisClient.on = jest.fn();
  mockRedisClient.zRemRangeByScore = jest.fn().mockResolvedValue(0);
  mockRedisClient.zAdd = jest.fn().mockResolvedValue(1);
  mockRedisClient.zCard = jest.fn().mockResolvedValue(0);
  await connectRateLimiter(mockRedisClient);
});

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
jest.doMock('bcryptjs', () => authHelpersMock.bcrypt, { virtual: true });

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// This will run after all tests
afterAll(async () => {
  // Close connections to prevent Jest from hanging
  await sequelize.close();
  await closeRateLimiter();
});
