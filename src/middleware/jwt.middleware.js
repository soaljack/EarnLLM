const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User } = require('../db/sequelize');

const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Authorization header is missing or invalid.'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return next(createError(401, 'User not found or inactive.'));
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, 'Token has expired'));
    }
    return next(createError(401, 'Invalid token.'));
  }
};

module.exports = { authenticateJWT };
