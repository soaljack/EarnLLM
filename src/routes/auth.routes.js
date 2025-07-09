const express = require('express');
const { createPublicRateLimiter } = require('../middleware/rateLimit.middleware');
const { authenticateJWT } = require('../middleware/jwt.middleware');
const validate = require('../middleware/validate.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');

const router = express.Router();

// --- Controllers ---
const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userProfile = await userService.getUserProfile(req.user.id);
    res.json(userProfile);
  } catch (error) {
    next(error);
  }
};

const refreshToken = (req, res) => {
  const result = authService.refreshToken(req.user);
  res.json(result);
};

const logout = (req, res) => {
  res.json({ message: 'Logout successful.' });
};

// --- Rate Limiters ---
const registerLimiter = createPublicRateLimiter({
  windowMs: 60 * 60 * 1000, max: 5, message: 'Too many accounts created from this IP.',
});

const loginLimiter = createPublicRateLimiter({
  windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts from this IP.',
});

// --- Routes ---
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authenticateJWT, getMe);
router.post('/refresh-token', authenticateJWT, refreshToken);
router.post('/logout', authenticateJWT, logout);

module.exports = router;
