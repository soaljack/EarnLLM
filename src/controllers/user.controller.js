const createError = require('http-errors');
const { Op } = require('sequelize');
const {
  User, ApiUsage, LlmModel, PricingPlan, BillingAccount, sequelize, ApiKey,
} = require('../db/sequelize');

// Get current user's API usage statistics
const getCurrentUserUsage = async (req, res, next) => {
  try {
    const { period } = req.query;
    let startDate; let
      endDate;

    // Determine date range based on period parameter
    const now = new Date();
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      default:
        // Default to last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        endDate = new Date();
    }

    // Run all usage queries in parallel for better performance
    const [usage, modelUsage, endpointUsage, totals] = await Promise.all([
      // Daily usage query
      ApiUsage.findAll({
        where: {
          UserId: req.user.id,
          createdAt: { [Op.between]: [startDate, endDate] },
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      }),
      // Model usage breakdown query
      ApiUsage.findAll({
        where: {
          UserId: req.user.id,
          createdAt: { [Op.between]: [startDate, endDate] },
        },
        attributes: [
          'LlmModelId',
          'externalModelId',
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        group: ['LlmModelId', 'externalModelId'],
        include: [{ model: LlmModel, attributes: ['name', 'provider', 'modelId'] }],
      }),
      // Endpoint usage query
      ApiUsage.findAll({
        where: {
          UserId: req.user.id,
          createdAt: { [Op.between]: [startDate, endDate] },
        },
        attributes: [
          'endpoint',
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        group: ['endpoint'],
      }),
      // Totals query
      ApiUsage.findOne({
        where: {
          UserId: req.user.id,
          createdAt: { [Op.between]: [startDate, endDate] },
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        raw: true,
      }),
    ]);

    return res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dailyUsage: usage,
      modelUsage,
      endpointUsage,
      totals: {
        totalTokens: parseInt(totals?.totalTokens || 0, 10),
        totalCostCents: parseFloat(totals?.totalCostCents || 0),
        requestCount: parseInt(totals?.requestCount || 0, 10),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Update current user's profile
const updateCurrentUserProfile = async (req, res, next) => {
  try {
    const {
      firstName, lastName, companyName, email, currentPassword, newPassword,
    } = req.body;

    // Check if email exists if trying to change it
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return next(createError(409, 'Email already in use'));
      }
    }

    // If changing password, validate current password
    if (newPassword) {
      if (!currentPassword) {
        return next(createError(400, 'Current password is required to set a new password'));
      }
      const isPasswordValid = await req.user.validatePassword(currentPassword);
      if (!isPasswordValid) {
        return next(createError(401, 'Invalid current password'));
      }
      // The password will be hashed by the model's beforeUpdate hook
      req.user.password = newPassword;
    }

    // Update user fields
    req.user.firstName = firstName !== undefined ? firstName : req.user.firstName;
    req.user.lastName = lastName !== undefined ? lastName : req.user.lastName;
    req.user.companyName = companyName !== undefined ? companyName : req.user.companyName;
    req.user.email = email !== undefined ? email : req.user.email;

    await req.user.save();

    // Return updated user (excluding password)
    const updatedUser = req.user.get({ plain: true });
    delete updatedUser.password;

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: PricingPlan,
          attributes: ['name', 'code'],
        },
        {
          model: BillingAccount,
          attributes: ['creditBalance', 'tokenUsageThisMonth', 'subscriptionStatus'],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      users,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run queries in parallel for performance
    const [user, usageSummary] = await Promise.all([
      User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [
          { model: PricingPlan },
          { model: BillingAccount },
          { model: ApiKey, attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt'] },
        ],
      }),
      ApiUsage.findOne({
        where: {
          UserId: id,
          createdAt: { [Op.gte]: startOfMonth },
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        raw: true,
      }),
    ]);

    if (!user) {
      return next(createError(404, 'User not found'));
    }

    return res.json({
      user,
      usageSummary: {
        totalTokens: parseInt(usageSummary?.totalTokens || 0, 10),
        totalCostCents: parseFloat(usageSummary?.totalCostCents || 0),
        requestCount: parseInt(usageSummary?.requestCount || 0, 10),
        period: 'current-month',
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Update user by ID (admin only)
const updateUserById = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      companyName,
      email,
      role,
      isActive,
      pricingPlanId,
      creditBalance,
      subscriptionStatus,
    } = req.body;

    const user = await User.findByPk(id, {
      include: [BillingAccount],
      transaction: t,
    });

    if (!user) {
      await t.rollback();
      return next(createError(404, 'User not found'));
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email }, transaction: t });
      if (existingUser) {
        await t.rollback();
        return next(createError(409, 'Email already in use'));
      }
    }

    const userUpdates = {};
    if (firstName !== undefined) userUpdates.firstName = firstName;
    if (lastName !== undefined) userUpdates.lastName = lastName;
    if (companyName !== undefined) userUpdates.companyName = companyName;
    if (email !== undefined) userUpdates.email = email;
    if (role !== undefined) userUpdates.role = role;
    if (isActive !== undefined) userUpdates.isActive = isActive;
    if (pricingPlanId !== undefined) userUpdates.PricingPlanId = pricingPlanId;

    Object.assign(user, userUpdates);

    if (user.BillingAccount) {
      const billingUpdates = {};
      if (creditBalance !== undefined) billingUpdates.creditBalance = creditBalance;
      if (subscriptionStatus !== undefined) billingUpdates.subscriptionStatus = subscriptionStatus;
      Object.assign(user.BillingAccount, billingUpdates);
      await user.BillingAccount.save({ transaction: t });
    } else if (creditBalance !== undefined || subscriptionStatus !== undefined) {
      await BillingAccount.create({
        UserId: user.id,
        creditBalance: creditBalance || 0,
        subscriptionStatus: subscriptionStatus || 'inactive',
      }, { transaction: t });
    }

    await user.save({ transaction: t });
    await t.commit();

    const reloadedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [PricingPlan, BillingAccount],
    });

    return res.json({
      message: 'User updated successfully',
      user: reloadedUser,
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

module.exports = {
  getCurrentUserUsage,
  updateCurrentUserProfile,
  getAllUsers,
  getUserById,
  updateUserById,
  // Other controller functions will be added here
};
