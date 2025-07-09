const express = require('express');

const { authenticateJWT } = require('../middleware/jwt.middleware');
const validate = require('../middleware/validate.middleware');
const { createApiKeySchema, updateApiKeySchema } = require('../validators/apiKey.validator');

const router = express.Router();
const {
  getAllApiKeys, createApiKey, updateApiKeyById, deleteApiKeyById, revokeApiKeyById,
} = require('../controllers/apiKey.controller');

/**
 * @route GET /api/api-keys
 * @desc Get all API keys for the current user
 * @access Private
 */
router.get('/', authenticateJWT, getAllApiKeys);

/**
 * @route POST /api/api-keys
 * @desc Create a new API key
 * @access Private
 */
router.post('/', authenticateJWT, validate(createApiKeySchema), createApiKey);

/**
 * @route PUT /api/api-keys/:id
 * @desc Update an API key
 * @access Private
 */
router.put('/:id', authenticateJWT, validate(updateApiKeySchema), updateApiKeyById);

/**
 * @route DELETE /api/api-keys/:id
 * @desc Delete an API key
 * @access Private
 */
router.delete('/:id', authenticateJWT, deleteApiKeyById);

/**
 * @route POST /api/api-keys/:id/revoke
 * @desc Revoke (deactivate) an API key
 * @access Private
 */
router.post('/:id/revoke', authenticateJWT, revokeApiKeyById);

module.exports = router;
