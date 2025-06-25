const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./src/models');
const config = require('./src/config');
const logger = require('./src/config/logger');
const routes = require('./src/routes');
const { connectRateLimiter } = require('./src/middleware/rateLimit.middleware');
const redis = require('redis');

// Initialize express app
const app = express();

// Setup request logging
const morganFormat = config.env === 'development' ? 'dev' : 'combined';
app.use(morgan(morganFormat, { stream: { write: (message) => logger.info(message.trim()) } }));

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: config.cors.origin })); // CORS handling
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Handle 404 Not Found errors
app.use((req, res, next) => {
  next(new ApiError(404, 'Not Found'));
});

// Convert non-ApiError errors to ApiError
const { errorConverter, errorHandler } = require('./src/middleware/error');

app.use(errorConverter);

// Handle all errors
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Sync database models
    await sequelize.sync({ alter: config.env === 'development' });
    logger.info('Database synchronized');

    // Initialize Redis for rate limiting
    if (config.env !== 'test') {
      const redisClient = redis.createClient({ url: process.env.REDIS_URL });
      await connectRateLimiter(redisClient);
    }

    // Start listening
    app.listen(config.port, () => {
      logger.info(`EarnLLM API running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Run server
if (require.main === module) {
  startServer();
}

module.exports = app;
