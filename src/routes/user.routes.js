const express = require('express');
const createError = require('http-errors');
const { Op } = require('sequelize');
const {
  User, ApiUsage, LlmModel, PricingPlan, BillingAccount, sequelize, ApiKey,
} = require('../db/sequelize');
const { authenticateJWT } = require('../middleware/jwt.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const validate = require('../middleware/validate.middleware');
const {
  updateCurrentUserSchema,
  createUserSchema,
  updateUserAsAdminSchema,
} = require('../validators/user.validator');

const router = express.Router();

// --- Controllers ---
const getCurrentUserUsage = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    let startDate;
    const now = new Date();
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week': {
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'year':
        startDate = new Date(now.setMonth(0, 1));
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    const [usage, modelUsage, totals] = await Promise.all([
      ApiUsage.findAll({
        where: { UserId: req.user.id, createdAt: { [Op.gte]: startDate } },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
          [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
        ],
        group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      }),
      ApiUsage.findAll({
        where: { UserId: req.user.id, createdAt: { [Op.gte]: startDate } },
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
      ApiUsage.findOne({
        where: { UserId: req.user.id, createdAt: { [Op.gte]: startDate } },
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
      startDate,
      dailyUsage: usage,
      modelUsage,
      totals,
    });
  } catch (error) {
    return next(error);
  }
};

const updateCurrentUserProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, companyName } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    const updatedUser = await user.update({ firstName, lastName, companyName });
    const userJSON = updatedUser.toJSON();
    delete userJSON.password;
    return res.json({ message: 'Profile updated successfully', user: userJSON });
  } catch (error) {
    return next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'DESC',
      search,
    } = req.query;
    const where = search
      ? {
        [Op.or]: [
          { email: { [Op.iLike]: `%${search}%` } },
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
        ],
      }
      : {};
    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [[sortBy, order]],
      attributes: { exclude: ['password'] },
    });
    return res.json({
      totalUsers: count,
      users: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
    });
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [user, usageSummary] = await Promise.all([
      User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [
          PricingPlan,
          BillingAccount,
          {
            model: ApiKey,
            attributes: ['id', 'name', 'prefix', 'isActive', 'lastUsedAt', 'expiresAt'],
          },
        ],
      }),
      ApiUsage.findOne({
        where: { UserId: id, createdAt: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
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
    return res.json({ user, usageSummary });
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const {
      email, password, firstName, lastName,
    } = req.body;
    const newUser = await User.create({
      email, password, firstName, lastName,
    });
    const userJson = newUser.toJSON();
    delete userJson.password;
    return res.status(201).json({
      message: 'User created successfully',
      user: userJson,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    await user.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

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

    const user = await User.findByPk(id, { include: [BillingAccount], transaction: t });
    if (!user) {
      await t.rollback();
      return next(createError(404, 'User not found'));
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email }, transaction: t });
      if (existingUser) {
        await t.rollback();
        return next(createError(400, 'Email already in use'));
      }
    }

    await user.update({
      firstName,
      lastName,
      companyName,
      email,
      role,
      isActive,
      PricingPlanId: pricingPlanId,
    }, { transaction: t });

    if (user.BillingAccount) {
      await user.BillingAccount.update({ creditBalance, subscriptionStatus }, { transaction: t });
    } else if (creditBalance !== undefined || subscriptionStatus !== undefined) {
      await BillingAccount.create({ UserId: id, creditBalance, subscriptionStatus }, { transaction: t });
    }
    await t.commit();
    const updatedUser = await User.findByPk(id, { attributes: { exclude: ['password'] } });
    return res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

// --- Routes ---
router.get('/me/usage', authenticateJWT, getCurrentUserUsage);
router.put('/me', authenticateJWT, validate(updateCurrentUserSchema), updateCurrentUserProfile);

// Admin routes
router.get('/', authenticateJWT, requireAdmin, getAllUsers);
router.post('/', authenticateJWT, requireAdmin, validate(createUserSchema), createUser);
router.get('/:id', authenticateJWT, requireAdmin, getUserById);
router.put('/:id', authenticateJWT, requireAdmin, validate(updateUserAsAdminSchema), updateUserById);
router.delete('/:id', authenticateJWT, requireAdmin, deleteUserById);

module.exports = router;
