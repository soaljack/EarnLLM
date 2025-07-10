/**
 * Unit Tests for Auth Middleware
 */

// BEFORE any require/import statements for the module-under-test or its direct dependencies
jest.resetModules(); // Reset module cache
jest.unmock('../../../src/middleware/auth.middleware'); // Ensure we test the REAL middleware

// Mock dependencies BEFORE requiring the module-under-test

const mockSequelizeModels = require('../../mocks/sequelize.mock');

jest.mock('../../../src/models', () => mockSequelizeModels);
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

const { User, ApiKey, PricingPlan } = require('../../../src/models'); // These will be mocked versions

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

      // mockJwtVerify is now globally configured for different token strings
      // The old mockImplementation block above was removed as mockJwtVerify handles this.

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        isActive: true,
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk.mockResolvedValue(mockUser);

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(mockUser.update).toHaveBeenCalledWith(expect.objectContaining({
        lastLoginAt: expect.any(Date),
      }));
      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // Called with no arguments
    });

    test('should return 401 when authorization header is missing', async () => {
      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('missing'),
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
        message: expect.stringContaining('Invalid authorization format'),
      }));
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    test('should return 401 when token is expired', async () => {
      // Setup
      req.headers.authorization = 'Bearer expired-token';

      const tokenError = new Error('Token expired');
      tokenError.name = 'TokenExpiredError';

      // mockJwtVerify is now globally configured for different token strings
      // (Previous incorrect mock lines including 'throw tokenError;' and '});' were removed here)

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

      const tokenError = new Error('Invalid token');
      tokenError.name = 'JsonWebTokenError';

      // mockJwtVerify is now globally configured for different token strings
      // (Previous incorrect mock lines including 'throw tokenError;' and '});' were removed here)

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
      req.headers.authorization = 'Bearer user-not-found-token'; // Use specific token for this scenario

      // Token 'user-not-found-token' is configured in mockJwtVerify to return { id: 999 }
      User.findByPk.mockResolvedValue(null);

      // Execute
      await authenticateJWT(req, res, next);

      // Assert
      expect(mockJwtVerify).toHaveBeenCalled();
      expect(User.findByPk).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('User not found'),
      }));
    });

    test('should return 403 when user account is inactive', async () => {
      // Setup
      req.headers.authorization = 'Bearer inactive-user-token'; // Use specific token for this scenario

      // Ensure this mock is active for the inactive user test
      User.findByPk.mockResolvedValue({ id: 1, isActive: false });

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
    test('should authenticate with valid API key', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-validprefix-rest-of-key';

      const mockUser = {
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
            toJSON: function toJSON() {
              return { ...this };
            },
          },
          toJSON: function toJSON() {
            return {
              id: 1,
              stripeSubscriptionStatus: 'active',
              PricingPlan: { id: 1, name: 'Free Tier' },
            };
          },
        },
        toJSON: function toJSON() {
          const rest = { ...this };
          delete rest.BillingAccount;
          return {
            ...rest,
            BillingAccount: this.BillingAccount.toJSON
              ? this.BillingAccount.toJSON()
              : this.BillingAccount,
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

      const mockApiKey = {
        id: 1,
        prefix: 'validpre',
        isActive: true,
        expiresAt: null,
        permissions: ['read:models'],
        UserId: 1,
        verify: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue(true),
        User: mockUser, // Ensure User object is part of mockApiKey if needed by any logic
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);
      User.findByPk.mockImplementation((id) => {
        if (id === mockApiKey.UserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(ApiKey.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { prefix: 'validpre' },
      }));
      expect(mockApiKey.verify).toHaveBeenCalledWith('validprefix-rest-of-key');
      expect(User.findByPk).toHaveBeenCalledWith(mockApiKey.UserId, {
        include: [{
          model: PricingPlan,
          as: 'PricingPlan',
        }],
      });
      expect(req.user).toEqual(mockUser);
      expect(req.apiKey).toBe(mockApiKey);
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // Called with no arguments
    });

    test('should return 401 when API key is missing', async () => {
      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('missing'),
      }));
      expect(ApiKey.findOne).not.toHaveBeenCalled();
    });

    test('should return 401 when API key format is invalid', async () => {
      // Setup
      req.headers.authorization = 'Bearer invalid-key-format';

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('Invalid API key format'),
      }));
      expect(ApiKey.findOne).not.toHaveBeenCalled();
    });

    test('should return 401 when API key is not found', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-notfound-rest-of-key';
      ApiKey.findOne.mockResolvedValue(null);

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(ApiKey.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { prefix: 'notfound' },
      }));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Invalid API key',
      }));
    });

    test('should return 403 when API key is inactive', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-inactive-rest-of-key';

      const mockApiKey = {
        prefix: 'inactive',
        isActive: false,
        expiresAt: null,
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('inactive'),
      }));
    });

    test('should return 403 when API key has expired', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-expired-rest-of-key';

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const mockApiKey = {
        prefix: 'expired',
        isActive: true,
        expiresAt: pastDate,
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('expired'),
      }));
    });

    test('should return 401 when API key verification fails', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-invalid-rest-of-key';

      const mockApiKey = {
        prefix: 'invalid',
        isActive: true,
        expiresAt: null,
        verify: jest.fn().mockReturnValue(false),
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(mockApiKey.verify).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('Invalid API key'),
      }));
    });

    test('should return 401 when user is not found or inactive', async () => {
      // Setup
      req.headers.authorization = 'Bearer sk-nouser-rest-of-key';

      const mockApiKey = {
        prefix: 'nouser',
        isActive: true,
        expiresAt: null,
        UserId: 999,
        verify: jest.fn().mockReturnValue(true),
      };

      ApiKey.findOne.mockResolvedValue(mockApiKey);
      User.findByPk.mockResolvedValue(null);

      // Execute
      await authenticateApiKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('User account is inactive or not found'),
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
    test('should allow when API key has the required permission', () => {
      // Setup
      req.apiKey = {
        permissions: ['read:models', 'write:models'],
      };
      const middleware = requireApiPermission('read:models');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // Called with no arguments
    });

    test('should block when API key does not have required permission', () => {
      // Setup
      req.apiKey = {
        permissions: ['read:models'],
      };
      const middleware = requireApiPermission('write:models');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Missing required permission'),
      }));
    });

    test('should return 403 if apiKey not available', () => {
      // Setup
      const middleware = requireApiPermission('read:models');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('API authentication required'),
      }));
    });
  });
});
