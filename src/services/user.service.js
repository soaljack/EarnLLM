const ApiError = require('../utils/ApiError');
const { User, PricingPlan, BillingAccount } = require('../db/sequelize');

/**
 * Get user profile by ID.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} - A promise that resolves to the user's profile.
 */
const getUserProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: PricingPlan },
      { model: BillingAccount },
    ],
    attributes: { exclude: ['password'] },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Format user response
  return {
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
};

module.exports = {
  getUserProfile,
};
