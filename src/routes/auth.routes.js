const express = require('express');

const { authenticateJWT } = require('../middleware/auth.middleware');
const { createPublicRateLimiter } = require('../middleware/rateLimit.middleware');
require('dotenv').config();
const {
  register, login, getMe, refreshToken, logout,
} = require('../controllers/auth.controller');

const router = express.Router();

// Apply a strict rate limit to registration to prevent abuse
const registerLimiter = createPublicRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per IP
  message: 'Too many accounts created from this IP, please try again after an hour.',
});

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registerLimiter, register);

// Apply a rate limit to login to prevent brute-force attacks
const loginLimiter = createPublicRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes per IP
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful attempts
});

/**
 * @route POST /api/auth/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post('/login', loginLimiter, login);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticateJWT, getMe);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh JWT token
 * @access Private
 */
router.post('/refresh-token', authenticateJWT, refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token deletion)
 * @access Private
 */
router.post('/logout', authenticateJWT, logout);

module.exports = router;
