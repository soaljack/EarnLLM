const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize with database connection parameters
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

// Import models
const User = require('./user')(sequelize);
const ApiKey = require('./apiKey')(sequelize);
const LlmModel = require('./llmModel')(sequelize);
const PricingPlan = require('./pricingPlan')(sequelize);
const BillingAccount = require('./billingAccount')(sequelize);
const ApiUsage = require('./apiUsage')(sequelize);
const ExternalModel = require('./externalModel')(sequelize);

// Define associations
User.hasMany(ApiKey);
ApiKey.belongsTo(User);

User.hasOne(BillingAccount);
BillingAccount.belongsTo(User);

PricingPlan.hasMany(User);
User.belongsTo(PricingPlan);

User.hasMany(ApiUsage);
ApiUsage.belongsTo(User);

LlmModel.hasMany(ApiUsage);
ApiUsage.belongsTo(LlmModel);

User.hasMany(ExternalModel);
ExternalModel.belongsTo(User);

const db = {
  sequelize,
  Sequelize,
  User,
  ApiKey,
  LlmModel,
  PricingPlan,
  BillingAccount,
  ApiUsage,
  ExternalModel,
};

module.exports = db;
