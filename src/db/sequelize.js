const { Sequelize } = require('sequelize');
const config = require('../config');
const initModels = require('../models');

// Create a new Sequelize instance based on the configuration
const sequelize = new Sequelize(
  config.sequelize.database,
  config.sequelize.username,
  config.sequelize.password,
  {
    ...config.sequelize,
    logging: config.env === 'development' ? console.log : false,
  },
);

// Initialize models with the sequelize instance
const models = initModels(sequelize);

// Export the sequelize instance and the initialized models
module.exports = {
  sequelize,
  ...models,
};
