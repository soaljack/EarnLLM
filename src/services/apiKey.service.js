const createError = require('http-errors');
const { ApiKey, sequelize } = require('../db/sequelize');

/**
 * Get all API keys for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<ApiKey[]>} - A promise that resolves to an array of API keys.
 */
const getAllApiKeysForUser = async (userId) => {
  const apiKeys = await ApiKey.findAll({
    where: { UserId: userId },
    attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt', 'permissions', 'createdAt'],
  });
  return apiKeys;
};

/**
 * Create a new API key for a user.
 * @param {string} userId - The ID of the user.
 * @param {object} keyData - The data for the new API key.
 * @param {string} keyData.name - The name of the API key.
 * @param {string[]} [keyData.permissions] - The permissions for the API key.
 * @param {Date} [keyData.expiresAt] - The expiration date for the API key.
 * @returns {Promise<object>} - A promise that resolves to the new API key object, including the full key.
 */
const createApiKey = async (userId, keyData) => {
  const { name, permissions, expiresAt } = keyData;

  if (!name) {
    throw createError(400, 'API key name is required');
  }

  // Generate a new API key
  const { prefix, fullKey, hashedKey } = ApiKey.generateKey();

  // Create the API key in the database
  const apiKey = await sequelize.transaction(async (t) => {
    const newApiKey = await ApiKey.create({
      name,
      prefix,
      key: hashedKey,
      permissions: permissions || ['chat:completion', 'embed'], // Default permissions
      expiresAt: expiresAt || null,
      UserId: userId,
    }, { transaction: t });
    return newApiKey;
  });

  // Return the API key details
  // IMPORTANT: fullKey is only returned once and never stored in plaintext
  return {
    id: apiKey.id,
    name: apiKey.name,
    key: fullKey, // This is the only time the full key will be shown
    prefix: apiKey.prefix,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  };
};

/**
 * Update an API key by ID.
 * @param {string} userId - The ID of the user.
 * @param {string} apiKeyId - The ID of the API key to update.
 * @param {object} updateData - The data to update.
 * @param {string} [updateData.name] - The new name for the API key.
 * @param {string[]} [updateData.permissions] - The new permissions for the API key.
 * @param {boolean} [updateData.isActive] - The new active status for the API key.
 * @returns {Promise<object>} - A promise that resolves to the updated API key object.
 */
const updateApiKeyById = async (userId, apiKeyId, updateData) => {
  const { name, permissions, isActive } = updateData;

  const apiKey = await sequelize.transaction(async (t) => {
    const keyToUpdate = await ApiKey.findOne({
      where: { id: apiKeyId, UserId: userId },
      transaction: t,
    });

    if (!keyToUpdate) {
      throw createError(404, 'API key not found');
    }

    if (name !== undefined) keyToUpdate.name = name;
    if (permissions !== undefined) keyToUpdate.permissions = permissions;
    if (isActive !== undefined) keyToUpdate.isActive = isActive;

    await keyToUpdate.save({ transaction: t });

    return keyToUpdate;
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    permissions: apiKey.permissions,
    isActive: apiKey.isActive,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
};

/**
 * Delete an API key by ID.
 * @param {string} userId - The ID of the user.
 * @param {string} apiKeyId - The ID of the API key to delete.
 * @returns {Promise<void>}
 */
const deleteApiKeyById = async (userId, apiKeyId) => {
  const deleted = await sequelize.transaction(async (t) => {
    return ApiKey.destroy({
      where: {
        id: apiKeyId,
        UserId: userId,
      },
      transaction: t,
    });
  });

  if (!deleted) {
    throw createError(404, 'API key not found');
  }
};

/**
 * Revoke (deactivate) an API key by ID.
 * @param {string} userId - The ID of the user.
 * @param {string} apiKeyId - The ID of the API key to revoke.
 * @returns {Promise<object>} - A promise that resolves to the revoked API key object.
 */
const revokeApiKeyById = async (userId, apiKeyId) => {
  const apiKey = await sequelize.transaction(async (t) => {
    const keyToRevoke = await ApiKey.findOne({
      where: { id: apiKeyId, UserId: userId },
      transaction: t,
    });

    if (!keyToRevoke) {
      throw createError(404, 'API key not found');
    }

    keyToRevoke.isActive = false;
    await keyToRevoke.save({ transaction: t });

    return keyToRevoke;
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    isActive: apiKey.isActive,
    message: 'API key revoked successfully',
  };
};

module.exports = {
  getAllApiKeysForUser,
  createApiKey,
  updateApiKeyById,
  deleteApiKeyById,
  revokeApiKeyById,
};
