/**
 * Jest Environment Setup
 * Setup for each test file
 */

// This runs before each test file

// Log test environment info
beforeAll(() => {
  console.log(`Running tests in ${process.env.NODE_ENV} environment`);
});
