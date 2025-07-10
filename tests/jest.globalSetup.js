const { execSync } = require('child_process');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');

// IMPORTANT: We are now using the centralized sequelize instance and models
// This ensures that the test environment is as close to production as possible.
const { sequelize, ...models } = require('../src/db/sequelize');

const testDbName = sequelize.config.database;

module.exports = async () => {
  console.log('\n[Jest Global Setup] Setting up test database...');

  // 1. Reset the database by dropping and recreating tables.
  try {
    // Authenticate to ensure the database connection is valid.
    await sequelize.authenticate();
    // Sync all models, dropping tables first if they exist.
    await sequelize.sync({ force: true });
  } catch (e) {
    console.error('Failed to sync database. Please check your database connection and permissions.', e);
    process.exit(1);
  }

  // 2. The database schema is now managed by `sequelize.sync()`.
  // The migration step is no longer needed for the test setup.

  // 3. Seed baseline data.
  await models.PricingPlan.create({
    name: 'Starter',
    code: 'starter',
    monthlyFee: 0,
    tokenAllowance: 100000,
    requestsPerMinute: 60,
  });

  // 4. Publish the sequelize instance and models object to the global scope.
  // This allows tests to access the same db connection and models as the app.
  global.sequelize = sequelize;
  global.models = models;

  console.log('[Jest Global Setup] Test database is ready.');
};
