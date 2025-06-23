/**
 * Jest Setup File
 * Loads test environment configurations and sets up the test database
 */

const dotenv = require('dotenv');
const path = require('path');
const { Sequelize } = require('sequelize');

// Load test environment variables
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
});

console.log('Test environment loaded:', process.env.NODE_ENV);
console.log('Using test database:', process.env.DB_NAME);

// Setup function - called once before all tests
module.exports = async () => {
  console.log('Setting up test database connection...');

  // Create Sequelize connection using SQLite in-memory database for tests
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:', // Use in-memory SQLite for tests
    logging: false, // Disable SQL logging during tests
  });

  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database - creates tables based on models
    // Force: true will drop tables before recreating - clean slate for tests
    // This is equivalent to running migrations from scratch
    await sequelize.sync({ force: true });
    console.log('Database synchronized for testing.');

    // Expose sequelize to global scope for tests
    global.__TEST_SEQUELIZE__ = sequelize;
  } catch (error) {
    console.error('Unable to connect to the database or sync schema:', error);
    process.exit(1);
  }
};
