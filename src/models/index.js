const { Sequelize } = require('sequelize');

// This function now accepts a sequelize instance, making the models portable
const initModels = (sequelize) => {
  const db = {};

  db.Sequelize = Sequelize;
  db.sequelize = sequelize;

  // Import models and initialize them with the provided sequelize instance
  db.User = require('./user')(sequelize, Sequelize);
  db.ApiKey = require('./apiKey')(sequelize, Sequelize);
  db.LlmModel = require('./llmModel')(sequelize, Sequelize);
  db.PricingPlan = require('./pricingPlan')(sequelize, Sequelize);
  db.BillingAccount = require('./billingAccount')(sequelize, Sequelize);
  db.ApiUsage = require('./apiUsage')(sequelize, Sequelize);
  db.ExternalModel = require('./externalModel')(sequelize, Sequelize);

  // Define associations
  Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  return db;
};

module.exports = initModels;
