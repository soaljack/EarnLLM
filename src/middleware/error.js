const { ValidationError } = require('sequelize');
const config = require('../config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (error instanceof ValidationError) {
      statusCode = 400;
      message = error.errors.map((e) => e.message).join(', ');
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      message = error.message;
    }

    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  let { statusCode, message } = err;

  if (config.env === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    status: 'error',
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  logger.error(err);

  res.status(statusCode).json(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
