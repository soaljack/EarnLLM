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

  // 1. Drop and recreate the database.
  try {
    execSync(`dropdb --if-exists ${testDbName} --force`, { stdio: 'ignore' });
    execSync(`createdb ${testDbName}`, { stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to recreate database. Make sure you have `createdb` and `dropdb` commands available.', e);
    process.exit(1);
  }

  // 2. Run migrations using the centralized sequelize instance.
  const umzug = new Umzug({
    migrations: { glob: path.join(__dirname, '../src/migrations/*.js') },
    context: {
      queryInterface: sequelize.getQueryInterface(),
      Sequelize,
    },
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
  await umzug.up();

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
