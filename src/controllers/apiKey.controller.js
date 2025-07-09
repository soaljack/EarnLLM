const { ApiKey, sequelize } = require('../db/sequelize');
const apiKeyService = require('../services/apiKey.service');

// Get all API keys for the current user
const getAllApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await apiKeyService.getAllApiKeysForUser(req.user.id);
    return res.json(apiKeys);
  } catch (error) {
    return next(error);
  }
};

// Create a new API key
const createApiKey = async (req, res, next) => {
  try {
    const newApiKey = await apiKeyService.createApiKey(req.user.id, req.body);
    return res.status(201).json(newApiKey);
  } catch (error) {
    return next(error);
  }
};

// Update an API key by ID
const updateApiKeyById = async (req, res, next) => {
  try {
    const updatedApiKey = await apiKeyService.updateApiKeyById(req.user.id, req.params.id, req.body);
    return res.json(updatedApiKey);
  } catch (error) {
    return next(error);
  }
};

// Delete an API key by ID
const deleteApiKeyById = async (req, res, next) => {
  try {
    await apiKeyService.deleteApiKeyById(req.user.id, req.params.id);
    return res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

// Revoke (deactivate) an API key by ID
const revokeApiKeyById = async (req, res, next) => {
  try {
    const revokedApiKey = await apiKeyService.revokeApiKeyById(req.user.id, req.params.id);
    return res.json(revokedApiKey);
  } catch (error) {
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
