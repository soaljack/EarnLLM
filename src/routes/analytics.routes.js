const express = require('express');
const { Op, Sequelize } = require('sequelize');
const {
  ApiUsage,
  LlmModel,
  User,
  ExternalModel,
  ApiKey,
  BillingAccount,
  PricingPlan,
} = require('../models');
const { authenticateJWT, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Helper function to get total usage for a time period
async function getTotalUsage(startDate) {
  const result = await ApiUsage.findOne({
    attributes: [
      [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
      [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
    ],
    where: {
      createdAt: { [Op.gte]: startDate },
    },
    raw: true,
  });

  return {
    totalTokens: parseInt(result?.totalTokens || 0, 10),
    totalCostCents: parseFloat(result?.totalCostCents || 0),
    requestCount: parseInt(result?.requestCount || 0, 10),
  };
}

// Helper function to get total revenue for a time period
async function getTotalRevenue(startDate) {
  const result = await ApiUsage.findOne({
    attributes: [
      [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
    ],
    where: {
      createdAt: { [Op.gte]: startDate },
    },
    raw: true,
  });

  return parseFloat(result?.totalCostCents || 0);
}

/**
 * @route GET /api/analytics/admin/overview
 * @desc Get system-wide analytics overview (admin only)
 * @access Admin
 */
router.get('/admin/overview', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();

    // Get timeframes for different periods
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    // Get total users
    const totalUsers = await User.count();
    const activeUsers = await User.count({
      where: {
        lastLoginAt: { [Op.gte]: oneMonthAgo },
      },
    });

    // Get total API keys
    const totalApiKeys = await ApiKey.count();
    const activeApiKeys = await ApiKey.count({
      where: {
        lastUsedAt: { [Op.gte]: oneMonthAgo },
        isActive: true,
      },
    });

    // Get system model usage
    const systemModelUsage = await ApiUsage.findAll({
      attributes: [
        'LlmModelId',
        [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
      ],
      where: {
        LlmModelId: { [Op.ne]: null },
        createdAt: { [Op.gte]: oneMonthAgo },
      },
      group: ['LlmModelId'],
      include: [{
        model: LlmModel,
        attributes: ['name', 'provider', 'modelId'],
      }],
      order: [[Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'DESC']],
    });

    // Get external model usage
    const externalModelUsage = await ApiUsage.findAll({
      attributes: [
        'externalModelId',
        [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
      ],
      where: {
        externalModelId: { [Op.ne]: null },
        createdAt: { [Op.gte]: oneMonthAgo },
      },
      group: ['externalModelId'],
      include: [{
        model: ExternalModel,
        attributes: ['name', 'userId', 'provider'],
      }],
      order: [[Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'DESC']],
    });

    // Get endpoint usage
    const endpointUsage = await ApiUsage.findAll({
      attributes: [
        'endpoint',
        [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
      ],
      where: {
        createdAt: { [Op.gte]: oneMonthAgo },
      },
      group: ['endpoint'],
      order: [[Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'DESC']],
    });

    // Get daily usage for the past 30 days
    const dailyUsage = await ApiUsage.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
      ],
      where: {
        createdAt: { [Op.gte]: oneMonthAgo },
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
    });

    // Get top users by usage
    const topUsers = await ApiUsage.findAll({
      attributes: [
        'UserId',
        [Sequelize.fn('SUM', Sequelize.col('totalTokens')), 'totalTokens'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'requestCount'],
      ],
      where: {
        createdAt: { [Op.gte]: oneMonthAgo },
      },
      group: ['UserId'],
      include: [{
        model: User,
        attributes: ['email', 'firstName', 'lastName', 'companyName'],
      }],
      order: [[Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'DESC']],
      limit: 10,
    });

    // Calculate totals
    const usage = {
      day: await getTotalUsage(oneDayAgo),
      week: await getTotalUsage(oneWeekAgo),
      month: await getTotalUsage(oneMonthAgo),
    };

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      apiKeys: {
        total: totalApiKeys,
        active: activeApiKeys,
      },
      usage,
      systemModelUsage,
      externalModelUsage,
      endpointUsage,
      dailyUsage,
      topUsers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/admin/users-growth
 * @desc Get user growth analytics (admin only)
 * @access Admin
 */
router.get('/admin/users-growth', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    // Calculate user registrations by day for the past 90 days
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const usersByDay = await User.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      where: {
        createdAt: { [Op.gte]: ninetyDaysAgo },
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
    });

    // Calculate user registrations by month for all time
    const usersByMonth = await User.findAll({
      attributes: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'year'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: [
        Sequelize.fn('YEAR', Sequelize.col('createdAt')),
        Sequelize.fn('MONTH', Sequelize.col('createdAt')),
      ],
      order: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'ASC'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC'],
      ],
    });

    // Calculate active users
    const [activeToday, activeThisWeek, activeThisMonth] = await Promise.all([
      User.count({
        where: {
          lastLoginAt: { [Op.gte]: new Date(now.setHours(0, 0, 0, 0)) },
        },
      }),
      User.count({
        where: {
          lastLoginAt: { [Op.gte]: new Date(now.setDate(now.getDate() - 7)) },
        },
      }),
      User.count({
        where: {
          lastLoginAt: { [Op.gte]: new Date(now.setMonth(now.getMonth() - 1)) },
        },
      }),
    ]);

    res.json({
      usersByDay,
      usersByMonth,
      activeUsers: {
        today: activeToday,
        thisWeek: activeThisWeek,
        thisMonth: activeThisMonth,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/admin/revenue
 * @desc Get revenue analytics (admin only)
 * @access Admin
 */
router.get('/admin/revenue', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    // Calculate revenue by day for the past 90 days
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    // Revenue from API usage
    const apiRevenueByDay = await ApiUsage.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
      ],
      where: {
        createdAt: { [Op.gte]: ninetyDaysAgo },
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
    });

    // Revenue by model
    const revenueByModel = await ApiUsage.findAll({
      attributes: [
        [Sequelize.fn('COALESCE', Sequelize.col('LlmModel.name'), Sequelize.col('ExternalModel.name')), 'modelName'],
        [Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'totalCostCents'],
        [Sequelize.fn('COUNT', Sequelize.col('ApiUsage.id')), 'requestCount'],
      ],
      include: [
        {
          model: LlmModel,
          attributes: ['name'],
          required: false,
        },
        {
          model: ExternalModel,
          attributes: ['name'],
          required: false,
        },
      ],
      where: {
        createdAt: { [Op.gte]: ninetyDaysAgo },
      },
      group: [
        [Sequelize.fn('COALESCE', Sequelize.col('LlmModel.name'), Sequelize.col('ExternalModel.name')), 'modelName'],
      ],
      order: [[Sequelize.fn('SUM', Sequelize.col('totalCostCents')), 'DESC']],
    });

    // Calculate monthly recurring revenue from subscription plans
    const recurringRevenue = await BillingAccount.findAll({
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('PricingPlan.monthlyFee')), 'monthlyRecurring'],
      ],
      include: [
        {
          model: User,
          attributes: [],
          include: [
            {
              model: PricingPlan,
              attributes: [],
            },
          ],
        },
      ],
      where: {
        subscriptionStatus: 'active',
      },
    });

    // Calculate totals for different periods
    const revenue = {
      day: await getTotalRevenue(oneDayAgo),
      week: await getTotalRevenue(oneWeekAgo),
      month: await getTotalRevenue(oneMonthAgo),
    };

    res.json({
      revenue,
      apiRevenueByDay,
      revenueByModel,
      monthlyRecurringRevenue: recurringRevenue[0]?.getDataValue('monthlyRecurring') || 0,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
