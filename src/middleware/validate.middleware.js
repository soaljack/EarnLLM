const createError = require('http-errors');

const validate = (schema) => async (req, res, next) => {
  try {
    await schema.validateAsync(req.body, { abortEarly: false });
    return next();
  } catch (error) {
    // Joi validation errors are returned as a single error object
    // containing an array of all validation issues.
    const validationErrors = error.details.map((detail) => detail.message).join(', ');
    return next(createError(400, `Validation failed: ${validationErrors}`));
  }
};

module.exports = validate;
