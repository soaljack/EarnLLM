const createError = require('http-errors');
const { ApiKey, sequelize } = require('../models');

// Get all API keys for the current user
const getAllApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await ApiKey.findAll({
      where: { UserId: req.user.id },
      attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt', 'permissions', 'createdAt'],
    });

    return res.json(apiKeys);
  } catch (error) {
    return next(error);
  }
};

// Create a new API key
const createApiKey = async (req, res, next) => {
  try {
    const { name, permissions, expiresAt } = req.body;

    if (!name) {
      return next(createError(400, 'API key name is required'));
    }

    // Generate a new API key
    const { prefix, fullKey, hashedKey } = ApiKey.generateKey();

    // Create the API key in the database
    const apiKey = await ApiKey.create({
      name,
      prefix,
      key: hashedKey,
      permissions: permissions || ['chat:completion', 'embed'], // Default permissions
      expiresAt: expiresAt || null,
      UserId: req.user.id,
    });

    // Return the API key details
    // IMPORTANT: fullKey is only returned once and never stored in plaintext
    return res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey, // This is the only time the full key will be shown
      prefix: apiKey.prefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

// Update an API key by ID
const updateApiKeyById = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, permissions, isActive } = req.body;

    const apiKey = await ApiKey.findOne({
      where: { id, UserId: req.user.id },
      transaction: t,
    });

    if (!apiKey) {
      await t.rollback();
      return next(createError(404, 'API key not found'));
    }

    await apiKey.update(
      {
        name: name !== undefined ? name : apiKey.name,
        permissions: permissions !== undefined ? permissions : apiKey.permissions,
        isActive: isActive !== undefined ? isActive : apiKey.isActive,
      },
      { transaction: t },
    );

    await t.commit();

    return res.json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      permissions: apiKey.permissions,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

// Delete an API key by ID
const deleteApiKeyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find and delete the API key
    const deleted = await ApiKey.destroy({
      where: {
        id,
        UserId: req.user.id, // Ensure the key belongs to the current user
      },
    });

    if (!deleted) {
      return next(createError(404, 'API key not found'));
    }

    return res.json({
      message: 'API key deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
};

// Revoke (deactivate) an API key by ID
const revokeApiKeyById = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, UserId: req.user.id },
      transaction: t,
    });

    if (!apiKey) {
      await t.rollback();
      return next(createError(404, 'API key not found'));
    }

    await apiKey.update({ isActive: false }, { transaction: t });

    await t.commit();

    return res.json({
      id: apiKey.id,
      name: apiKey.name,
      isActive: apiKey.isActive,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

module.exports = {
  getAllApiKeys,
  createApiKey,
  updateApiKeyById,
  deleteApiKeyById,
  revokeApiKeyById,
  // Other controller functions will be added here
};
