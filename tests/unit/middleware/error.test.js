const { StatusCodes } = require('http-status-codes');
const { errorConverter, errorHandler } = require('../../../src/middleware/error');
const ApiError = require('../../../src/utils/ApiError');
const config = require('../../../src/config');
const logger = require('../../../src/config/logger');

describe('Error Middleware', () => {
  describe('errorConverter', () => {
    it('should convert a generic Error to ApiError with status 500', () => {
      const error = new Error('Test error');
      const next = jest.fn();

      errorConverter(error, {}, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const apiError = next.mock.calls[0][0];
      expect(apiError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(apiError.message).toBe('Internal Server Error');
      expect(apiError.isOperational).toBe(false);
    });

    it('should not convert an error that is already an instance of ApiError', () => {
      const error = new ApiError(StatusCodes.BAD_REQUEST, 'Bad request');
      const next = jest.fn();

      errorConverter(error, {}, {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle Sequelize validation errors', () => {
      const error = {
        name: 'SequelizeValidationError',
        errors: [{ message: 'Field is required' }, { message: 'Another field is invalid' }],
      };
      const next = jest.fn();

      errorConverter(error, {}, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const apiError = next.mock.calls[0][0];
      expect(apiError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(apiError.message).toBe('Field is required, Another field is invalid');
    });
  });

  describe('errorHandler', () => {
    let res;
    let next;
    let errorLoggerSpy;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: {},
      };
      next = jest.fn();
      errorLoggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should send a proper error response and log the error in development', () => {
      const originalEnv = config.env;
      config.env = 'development';
      const error = new ApiError(StatusCodes.BAD_REQUEST, 'Any error');

      errorHandler(error, {}, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Any error',
        stack: error.stack,
      });
      expect(errorLoggerSpy).toHaveBeenCalledWith(error);

      config.env = originalEnv;
    });

    it('should not send stack trace in production', () => {
      const originalEnv = config.env;
      config.env = 'production';
      const error = new ApiError(StatusCodes.BAD_REQUEST, 'Any error');

      errorHandler(error, {}, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Any error',
      });
      expect(errorLoggerSpy).toHaveBeenCalledWith(error);

      config.env = originalEnv;
    });

    it('should replace error with generic message in production for non-operational errors', () => {
      const originalEnv = config.env;
      config.env = 'production';
      const error = new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal error', false);

      errorHandler(error, {}, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal Server Error',
      });
      expect(errorLoggerSpy).toHaveBeenCalledWith(error);
      config.env = originalEnv;
    });
  });
});
