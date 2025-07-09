const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { User, BillingAccount, PricingPlan, sequelize } = require('../db/sequelize');

/**
 * Register a new user.
 * @param {object} userData - The data for the new user.
 * @returns {Promise<object>} - A promise that resolves to the new user object and a JWT token.
 */
const register = async (userData) => {
  const {
    email, password, firstName, lastName, companyName,
  } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  // Get the free tier pricing plan
  const freeTier = await PricingPlan.findOne({
    where: { code: 'starter' },
  });

  if (!freeTier) {
    // It's good practice to log this server-side as well
    console.error('CRITICAL: Default pricing plan "starter" not found.');
    throw new ApiError(500, 'Unable to find default pricing plan. Please contact support.');
  }

  const user = await sequelize.transaction(async (t) => {
    // Create the user
    const newUser = await User.create({
      email,
      password, // Will be hashed by model hook
      firstName,
      lastName,
      companyName,
      PricingPlanId: freeTier.id,
    }, { transaction: t });

    // Create billing account for the user
    await BillingAccount.create({
      UserId: newUser.id,
      creditBalance: 0, // Start with no credits
      tokenUsageThisMonth: 0,
      billingEmail: email,
      paymentsEnabled: false, // Default, can be changed later
    }, { transaction: t });

    return newUser;
  });

  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET, // Make sure JWT_SECRET is available
    { expiresIn: process.env.JWT_EXPIRY }, // Make sure JWT_EXPIRY is available
  );

  // Return user info (excluding password) and token
  const userResponse = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    pricingPlan: { // Consider creating a helper to format this
      id: freeTier.id,
      name: freeTier.name,
      code: freeTier.code,
    },
  };

  return {
    message: 'User registered successfully',
    user: userResponse,
    token,
  };
};

/**
 * Login a user.
 * @param {object} loginData - The login data.
 * @param {string} loginData.email - The user's email.
 * @param {string} loginData.password - The user's password.
 * @returns {Promise<object>} - A promise that resolves to the user object and a JWT token.
 */
const login = async (loginData) => {
  const { email, password } = loginData;

  // Find user by email
  const user = await User.findOne({
    where: { email },
    include: [{ model: PricingPlan }],
  });

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if password is correct
  const isPasswordMatch = await user.validatePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if user account is active
  if (!user.isActive) {
    throw new ApiError(403, 'Account is inactive');
  }

  // Update last login timestamp
  await user.update({ lastLoginAt: new Date() });

  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY },
  );

  // Return user info and token
  const userResponse = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    isAdmin: user.isAdmin,
    pricingPlan: {
      id: user.PricingPlan.id,
      name: user.PricingPlan.name,
      code: user.PricingPlan.code,
    },
  };

  return {
    message: 'Login successful',
    user: userResponse,
    token,
  };
};

/**
 * Refresh JWT token.
 * @param {object} user - The user object from the JWT.
 * @returns {object} - An object containing the new token and a success message.
 */
const refreshToken = (user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY },
  );

  return {
    message: 'Token refreshed successfully',
    token,
  };
};

module.exports = {
  register,
  login,
  refreshToken,
};
