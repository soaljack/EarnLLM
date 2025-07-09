
const authService = require('../services/auth.service');
const userService = require('../services/user.service');

// Register a new user
const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

// Get current user profile
const getMe = async (req, res, next) => {
  try {
    const userProfile = await userService.getUserProfile(req.user.id);
    return res.json(userProfile);
  } catch (error) {
    return next(error);
  }
};

// Refresh JWT token
const refreshToken = (req, res) => {
  const result = authService.refreshToken(req.user);
  res.json(result);
};

// Logout user (client-side token deletion)
const logout = (req, res) => {
  // Server-side we don't actually invalidate JWT tokens as they are stateless.
  // Client will need to remove the token from storage.
  // Optionally, could add token to a blacklist if using a more complex setup.
  res.json({
    message: 'Logout successful. Please clear your token on the client-side.',
  });
};

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout,
};
