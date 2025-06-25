const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User, ApiKey, PricingPlan } = require('../models');
require('dotenv').config();

// Immediately export an object to break circular dependencies
const authMiddleware = {};
module.exports = authMiddleware;

/**
 * Middleware to authenticate users via JWT token
 */
authMiddleware.authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(createError(401, 'Authorization header is missing'));
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return next(createError(401, 'Invalid authorization format. Format is "Bearer <token>"'));
    }

    const token = tokenParts[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return next(createError(401, 'User not found'));
    }

    if (!user.isActive) {
      return next(createError(403, 'User account is inactive'));
    }

    // Update last login time
    await user.update({ lastLoginAt: new Date() });

    // Set user in request object
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, 'Token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(createError(401, 'Invalid token'));
    }
    return next(error);
  }
};

/**
 * Middleware to authenticate API requests using API key
 */
authMiddleware.authenticateApiKey = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(createError(401, 'Authorization header is missing'));
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return next(createError(401, 'Invalid authorization format. Format is "Bearer <token>"'));
    }

    const apiKeyHeader = tokenParts[1];

    if (!apiKeyHeader.startsWith('sk-')) {
      return next(createError(401, 'Invalid API key format'));
    }

    // Extract prefix from API key
    const prefix = apiKeyHeader.substring(3, 11);

    // Find API key by prefix
    const apiKey = await ApiKey.findOne({ where: { prefix } });
    if (!apiKey) {
      return next(createError(401, 'Invalid API key'));
    }

    // Verify API key
    if (!apiKey.isActive) {
      return next(createError(403, 'API key is inactive'));
    }

    // Check if API key has expired
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return next(createError(403, 'API key has expired'));
    }

    // Verify the API key (full comparison)
    const isValidKey = await apiKey.verify(apiKeyHeader.substring(3));
    if (!isValidKey) {
      return next(createError(401, 'Invalid API key'));
    }

    // Get the user associated with this API key
    const user = await User.findByPk(apiKey.UserId, {
      include: [{
        model: PricingPlan,
        as: 'PricingPlan',
      }],
    });
    if (!user || !user.isActive) {
      return next(createError(401, 'User account is inactive or not found'));
    }

    // Update last used timestamp
    await apiKey.update({ lastUsedAt: new Date() });

    // Attach user and API key to request
    req.user = user;
    req.apiKey = apiKey;

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Middleware to check if user has admin role
 */
authMiddleware.requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return next(createError(403, 'Admin access required'));
  }
  return next();
};

/**
 * Middleware to check for specific API key permissions
 */
authMiddleware.requireApiPermission = (permission) => (req, res, next) => {
  if (!req.apiKey) {
    return next(createError(403, 'API authentication required'));
  }

  if (!req.apiKey.permissions.includes(permission)) {
    return next(createError(403, `Missing required permission: ${permission}`));
  }

  return next();
};
