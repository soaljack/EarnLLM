/**
 * Unit Tests for Auth Middleware
 */

// BEFORE any require/import statements for the module-under-test or its direct dependencies
jest.resetModules(); // Reset module cache
jest.unmock('../../../src/middleware/jwt.middleware'); // Ensure we test the REAL middleware

// Mock dependencies BEFORE requiring the module-under-test

const crypto = require('crypto');
const mockSequelizeModels = require('../../mocks/sequelize.mock');

jest.mock('../../../src/models', () => mockSequelizeModels);

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'), // Keep other crypto functions
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(),
  }),
}));

const mockJwtVerify = jest.fn((token, secret) => {
  // Ensure JWT_SECRET is available for comparison, or use a default test secret if necessary
  const expectedSecret = process.env.JWT_SECRET || 'test_secret_key';
  if (token === 'valid-token' && secret === expectedSecret) {
    return { id: 1 }; // Standard valid decoded token
  }
  if (token === 'expired-token') {
    const error = new Error('Token expired');
    error.name = 'TokenExpiredError';
    throw error;
  }
  if (token === 'user-not-found-token') { // Specific token for user not found scenario
    return { id: 999 };
  }
  if (token === 'inactive-user-token') { // Specific token for inactive user scenario
    return { id: 1 };
  }
  // Default for other invalid token cases (JsonWebTokenError)
  const error = new Error('Invalid token');
  error.name = 'JsonWebTokenError';
  throw error;
});
jest.mock('jsonwebtoken', () => ({ verify: mockJwtVerify }));
jest.mock('http-errors', () => jest.fn().mockImplementation((code, message) => ({ status: code, message })));

// Now require the module under test and its (mocked) dependencies
const { authenticateJWT } = require('../../../src/middleware/jwt.middleware');
const { authenticateApiKey } = require('../../../src/middleware/apiKey.middleware');
const { requireAdmin } = require('../../../src/middleware/admin.middleware');
const { requireApiPermission } = require('../../../src/middleware/permission.middleware');

const { User, ApiKey } = require('../../../src/models'); // These will be mocked versions

describe('Authentication Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup test fixtures
    req = {
      headers: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  describe('authenticateJWT', () => {
    test('should authenticate user with valid JWT token', async () => {
      // Setup
      req.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 1, email: 'test@example.com', isActive: true, update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(mockUser.update).toHaveBeenCalledWith({ lastLoginAt: expect.any(Date) });
      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalledWith();
    });

    test('should return 401 when authorization header is missing', async () => {
      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('missing or invalid'),
      }));
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    test('should return 401 when token format is invalid', async () => {
      // Setup
      req.headers.authorization = 'InvalidFormat token';

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('missing or invalid'),
      }));
    });

    test('should return 401 when token is expired', async () => {
      // Setup
      req.headers.authorization = 'Bearer expired-token';

      // mockJwtVerify is configured to throw TokenExpiredError for 'expired-token'

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('expired-token', process.env.JWT_SECRET);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('expired'),
      }));
    });

    test('should return 401 when JWT is invalid', async () => {
      // Setup
      req.headers.authorization = 'Bearer invalid-token';

      // mockJwtVerify is configured to throw JsonWebTokenError for 'invalid-token'

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('invalid-token', process.env.JWT_SECRET);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('Invalid token'),
      }));
    });

    test('should return 401 when user not found', async () => {
      // Setup
      req.headers.authorization = 'Bearer user-not-found-token';
      User.findByPk.mockResolvedValue(null);

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('user-not-found-token', process.env.JWT_SECRET);
      expect(User.findByPk).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('User not found'),
      }));
    });

    test('should return 403 when user account is inactive', async () => {
      // Setup
      req.headers.authorization = 'Bearer inactive-user-token';
      const mockInactiveUser = { id: 1, isActive: false };
      User.findByPk.mockResolvedValue(mockInactiveUser);

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('inactive-user-token', process.env.JWT_SECRET);
      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('inactive'),
      }));
    });
  });

  describe('authenticateApiKey', () => {
    const mockHashedKey = 'hashed-valid-key';

    beforeEach(() => {
      crypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockHashedKey),
      });
    });

    test('should authenticate with valid API key', async () => {
      req.headers.authorization = 'Bearer sk-valid-key';
      const mockUser = { id: 1, isActive: true, PricingPlan: { permissions: ['read:models'] } };
      const mockApiKey = {
        id: 1, UserId: 1, isActive: true, expiresAt: null, update: jest.fn(),
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);
      User.findByPk.mockResolvedValue(mockUser);

      await authenticateApiKey(req, res, next);

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(crypto.createHash().update).toHaveBeenCalledWith('valid-key');
      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { key: mockHashedKey } });
      expect(User.findByPk).toHaveBeenCalledWith(mockApiKey.UserId, expect.any(Object));
      expect(mockApiKey.update).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
      expect(req.user).toBe(mockUser);
      expect(req.apiKey).toBe(mockApiKey);
      expect(next).toHaveBeenCalledWith();
    });

    test('should return 401 when API key is missing', async () => {
      await authenticateApiKey(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('missing or invalid'),
      }));
      expect(ApiKey.findOne).not.toHaveBeenCalled();
    });

    test('should return 401 when API key is not found', async () => {
      req.headers.authorization = 'Bearer sk-not-found-key';
      ApiKey.findOne.mockResolvedValue(null);
      await authenticateApiKey(req, res, next);
      expect(ApiKey.findOne).toHaveBeenCalledWith({ where: { key: mockHashedKey } });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Invalid API key.' }));
    });

    test('should return 403 when API key is inactive', async () => {
      req.headers.authorization = 'Bearer sk-inactive-key';
      const mockApiKey = { isActive: false };
      ApiKey.findOne.mockResolvedValue(mockApiKey);
      await authenticateApiKey(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, message: 'API key is inactive.' }));
    });

    test('should return 401 when user is not found or inactive', async () => {
      req.headers.authorization = 'Bearer sk-valid-key';
      const mockApiKey = {
        id: 1, UserId: 999, isActive: true, expiresAt: null,
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);
      User.findByPk.mockResolvedValue(null);
      await authenticateApiKey(req, res, next);
      expect(User.findByPk).toHaveBeenCalledWith(999, expect.any(Object));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401, message: 'User account is inactive or not found.',
      }));
    });
  });

  describe('requireAdmin', () => {
    test('should allow admin users', () => {
      // Setup
      req.user = { isAdmin: true };

      // Execute
      requireAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // Called with no arguments
    });

    test('should block non-admin users', () => {
      // Setup
      req.user = { isAdmin: false };

      // Execute
      requireAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Admin access required'),
      }));
    });

    test('should block if user is not set', () => {
      // Execute
      requireAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Admin access required'),
      }));
    });
  });

  describe('requireApiPermission', () => {
    test('should allow when user plan has required permission', () => {
      req.user = { PricingPlan: { permissions: ['read:models'] } };
      const middleware = requireApiPermission('read:models');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('should block when user plan is missing permission', () => {
      // Setup
      req.user = { PricingPlan: { permissions: ['read:models'] } };
      const middleware = requireApiPermission('write:models');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test('should block if user or plan is missing', () => {
      // Setup
      req.user = null;
      const middleware = requireApiPermission('read:models');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });
  });
});
