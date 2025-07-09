const app = require('./app');
const { Sequelize } = require('sequelize');
const initModels = require('./src/models');
const config = require('./src/config');
const logger = require('./src/config/logger');
const redis = require('redis');
const { connectRateLimiter } = require('./src/middleware/rateLimit.middleware');

// Initialize Sequelize and models
const sequelize = new Sequelize(config.sequelize.database, config.sequelize.username, config.sequelize.password, {
  host: config.sequelize.host,
  port: config.sequelize.port,
  dialect: 'postgres',
  logging: config.env === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Pass the sequelize instance to the models
initModels(sequelize);

const server = app.listen(config.port, async () => {
  try {
    await sequelize.sync({ alter: config.env === 'development' });
    logger.info('Database synchronized');

    if (config.env !== 'test') {
      const redisClient = redis.createClient({ url: process.env.REDIS_URL });
      await connectRateLimiter(redisClient);
    }

    logger.info(`EarnLLM API running on port ${config.port}`);
    logger.info(`Environment: ${config.env}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});

module.exports = server;
