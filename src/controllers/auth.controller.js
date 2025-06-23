const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User, BillingAccount, PricingPlan } = require('../models');
// Ensure dotenv is configured if process.env variables are used directly here
// require('dotenv').config(); // Might be needed if JWT_SECRET/EXPIRY are not globally available

// Register a new user
const register = async (req, res, next) => {
  try {
    const {
      email, password, firstName, lastName, companyName,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(createError(409, 'User with this email already exists'));
    }

    // Get the free tier pricing plan
    const freeTier = await PricingPlan.findOne({
      where: { code: 'starter' },
    });

    if (!freeTier) {
      // It's good practice to log this server-side as well
      console.error('CRITICAL: Default pricing plan "starter" not found.');
      return next(createError(500, 'Unable to find default pricing plan. Please contact support.'));
    }

    // Create the user
    const user = await User.create({
      email,
      password, // Will be hashed by model hook
      firstName,
      lastName,
      companyName,
      PricingPlanId: freeTier.id,
    });

    // Create billing account for the user
    // Consider if this should be in a transaction with User.create
    await BillingAccount.create({
      UserId: user.id,
      creditBalance: 0, // Start with no credits
      tokenUsageThisMonth: 0,
      billingEmail: email,
      paymentsEnabled: false, // Default, can be changed later
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

    return res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token,
    });
  } catch (error) {
    // Log the detailed error on the server for debugging
    console.error('Error in user registration:', error);
    // Pass a generic or specific error to the client
    return next(error); // Or next(createError(500, 'User registration failed'));
  }
};

// Login user
const login = async (req, res, next) => {
  console.log('LOGIN_DEBUG: Entered /login controller function.');
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({
      where: { email },
      include: [{ model: PricingPlan }],
    });
    console.log('LOGIN_DEBUG: User found by findOne in controller:', JSON.stringify(user, null, 2));

    if (!user) {
      return next(createError(401, 'Invalid email or password'));
    }

    // Check if user account is active
    console.log('LOGIN_DEBUG: User isActive in controller:', user.isActive);
    if (!user.isActive) {
      return next(createError(403, 'Account is inactive'));
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(password);
    console.log('LOGIN_DEBUG: isPasswordValid in controller:', isPasswordValid);
    if (!isPasswordValid) {
      return next(createError(401, 'Invalid email or password'));
    }

    // Update last login timestamp
    console.log('LOGIN_DEBUG: Before user.update in controller. User object:', JSON.stringify(user, null, 2));
    await user.update({ lastLoginAt: new Date() });
    console.log('LOGIN_DEBUG: After user.update in controller.');

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

    return res.json({
      message: 'Login successful',
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error('LOGIN_DEBUG: Error in login controller:', error.message, error.stack);
    return next(error);
  }
};

// Get current user profile
const getMe = async (req, res, next) => {
  try {
    // Get user with pricing plan and billing account info
    // req.user.id is available from authenticateJWT middleware
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: PricingPlan },
        { model: BillingAccount },
      ],
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return next(createError(404, 'User not found'));
    }

    // Format user response
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      pricingPlan: {
        id: user.PricingPlan.id,
        name: user.PricingPlan.name,
        code: user.PricingPlan.code,
        monthlyFee: user.PricingPlan.monthlyFee,
        allowBYOM: user.PricingPlan.allowBYOM,
      },
      billing: {
        creditBalance: user.BillingAccount.creditBalance,
        tokenUsageThisMonth: user.BillingAccount.tokenUsageThisMonth,
        subscriptionStatus: user.BillingAccount.subscriptionStatus,
        currentPeriodEnd: user.BillingAccount.currentPeriodEnd,
      },
    };

    return res.json(userResponse);
  } catch (error) {
    console.error('Error in getMe controller:', error);
    return next(error);
  }
};

// Refresh JWT token
const refreshToken = (req, res) => {
  // req.user is available from authenticateJWT middleware
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY },
  );

  res.json({
    message: 'Token refreshed successfully',
    token,
  });
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
