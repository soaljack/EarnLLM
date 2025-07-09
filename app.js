const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./src/config');
const logger = require('./src/config/logger');
const routes = require('./src/routes');
const ApiError = require('./src/utils/ApiError');
const requestTracer = require('./src/middleware/trace');
const { errorConverter, errorHandler } = require('./src/middleware/error');

const app = express();

app.use(requestTracer);

if (config.env !== 'test') {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
}

app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/v1', routes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.use((req, res, next) => {
  next(new ApiError(404, 'Not Found'));
});

app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
