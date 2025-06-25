module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of glob patterns for which coverage information should be collected
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],

  // An array of regexp pattern strings matched against all test paths before executing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '<rootDir>/tests/live-api/', // Exclude live API tests from the standard run
    // Enhanced tests should run to ensure we catch all issues
  ],

  // Setup files to run before each test
  // Note: Combined with the entry below

  // A map from regular expressions to paths to transformers
  transform: {},

  // An array of regexp patterns matched against all source file paths before re-running
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // Setup files that will run before each test file
  setupFilesAfterEnv: [
    './tests/jest.env.js',
    '<rootDir>/tests/setup.js',
  ],

  moduleNameMapper: {
    '^redis$': '<rootDir>/tests/__mocks__/redis.js',
    '^sequelize$': '<rootDir>/tests/__mocks__/sequelize.js',
  },
};
