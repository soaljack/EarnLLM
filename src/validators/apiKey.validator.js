const Joi = require('joi');

const createApiKeySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
});

const updateApiKeySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
});

module.exports = {
  createApiKeySchema,
  updateApiKeySchema,
};
