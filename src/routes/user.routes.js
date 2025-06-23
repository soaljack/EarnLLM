const express = require('express');

const { authenticateJWT, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const {
  getCurrentUserUsage, updateCurrentUserProfile, getAllUsers, getUserById, updateUserById,
} = require('../controllers/user.controller');

/**
 * @route GET /api/users/me/usage
 * @desc Get current user's API usage statistics
 * @access Private
 */
router.get('/me/usage', authenticateJWT, getCurrentUserUsage);

/**
 * @route PUT /api/users/me
 * @desc Update current user's profile
 * @access Private
 */
router.put('/me', authenticateJWT, updateCurrentUserProfile);

/**
 * ADMIN ROUTES
 */

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Admin
 */
router.get('/', authenticateJWT, requireAdmin, getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID (admin only)
 * @access Admin
 */
router.get('/:id', authenticateJWT, requireAdmin, getUserById);

/**
 * @route PUT /api/users/:id
 * @desc Update user (admin only)
 * @access Admin
 */
router.put('/:id', authenticateJWT, requireAdmin, updateUserById);

module.exports = router;
