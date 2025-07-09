const createError = require('http-errors');
const { ApiKey, User, PricingPlan } = require('../db/sequelize');

const authenticateApiKey = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Authorization header is missing or invalid. Format is "Bearer <token>"'));
    }

    const apiKeyHeader = authHeader.split(' ')[1];
    if (!apiKeyHeader || !apiKeyHeader.startsWith('sk-')) {
      return next(createError(401, 'Invalid API key format.'));
    }

    const rawKey = apiKeyHeader.substring(3);
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.findOne({ where: { key: hashedKey } });

    if (!apiKey) {
      // Note: We still use a generic error message to prevent leaking information
      // about whether a key exists or not.
      return next(createError(401, 'Invalid API key.'));
    }

    if (!apiKey.isActive) {
      return next(createError(403, 'API key is inactive.'));
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return next(createError(403, 'API key has expired.'));
    }

    const user = await User.findByPk(apiKey.UserId, {
      include: [{ model: PricingPlan, as: 'PricingPlan' }],
    });

    if (!user || !user.isActive) {
      return next(createError(401, 'User account is inactive or not found.'));
    }

    await apiKey.update({ lastUsedAt: new Date() });

    req.user = user;
    req.apiKey = apiKey;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authenticateApiKey };
