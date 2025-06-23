// tests/jest.teardown.js
module.exports = async () => {
  if (global.__TEST_SEQUELIZE__) {
    console.log('Closing test database connection...');
    await global.__TEST_SEQUELIZE__.close();
    console.log('Test database connection closed.');
  }
};
