const Joi = require('joi');

// Schema for a user updating their own profile
const updateCurrentUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  companyName: Joi.string().min(2).max(100).optional(),
}).min(1); // At least one field must be provided for an update

// Schema for an admin updating any user's profile
const updateUserAsAdminSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  companyName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('user', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  pricingPlanId: Joi.string().uuid().optional(),
  creditBalance: Joi.number().min(0).optional(),
  subscriptionStatus: Joi.string().valid('active', 'inactive', 'past_due', 'canceled').optional(),
}).min(1);

module.exports = {
  updateCurrentUserSchema,
  updateUserAsAdminSchema,
};
