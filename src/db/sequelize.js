const { Sequelize } = require('sequelize');
const config = require('../config');
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

const modelDefiners = [
  require('../models/user'),
  require('../models/apiKey'),
  require('../models/llmModel'),
  require('../models/pricingPlan'),
  require('../models/billingAccount'),
  require('../models/apiUsage'),
  require('../models/externalModel'),
];

// We define all models according to their files.
for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize, Sequelize);
}

// We execute any extra setup after the models are defined, such as adding associations.
const { User, ApiKey, LlmModel, PricingPlan, BillingAccount, ApiUsage, ExternalModel } = sequelize.models;

if (User.associate) {
  User.associate(sequelize.models);
  ApiKey.associate(sequelize.models);
  LlmModel.associate(sequelize.models);
  PricingPlan.associate(sequelize.models);
  BillingAccount.associate(sequelize.models);
  ApiUsage.associate(sequelize.models);
  ExternalModel.associate(sequelize.models);
}

// Export the sequelize instance and the initialized models
module.exports = {
  sequelize,
  User,
  ApiKey,
  LlmModel,
  PricingPlan,
  BillingAccount,
  ApiUsage,
  ExternalModel,
};
