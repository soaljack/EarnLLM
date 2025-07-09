const createError = require('http-errors');

const requireApiPermission = (permission) => (req, res, next) => {
  if (!req.user || !req.user.PricingPlan || !req.user.PricingPlan.permissions.includes(permission)) {
    return next(createError(403, `You do not have permission to '${permission}'. Please upgrade your plan.`));
  }
  return next();
};

module.exports = { requireApiPermission };
