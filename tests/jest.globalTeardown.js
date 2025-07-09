const { execSync } = require('child_process');
const config = require('../src/config');

const testDbName = `${config.sequelize.database}_test`;

module.exports = async () => {
  console.log('\n[Jest Global Teardown] Tearing down test database...');

  // Explicitly close the main sequelize connection
  // This is crucial to prevent Jest from hanging.
  if (global.sequelize) {
    await global.sequelize.close();
    console.log('[Jest Global Teardown] Sequelize connection closed.');
  } else {
    console.log('[Jest Global Teardown] No global sequelize instance found to close.');
  }

  try {
    execSync(`dropdb --if-exists ${testDbName} --force`, { stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to drop test database.', e);
    // Don't exit process with error, as it might be a permissions issue
    // and we don't want to fail the whole test run for it.
  }
  console.log('[Jest Global Teardown] Test database torn down.');
};
