module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/live-api'],
  // Use setupFiles to load env vars before any other code, including the test framework
  setupFiles: ['<rootDir>/tests/dotenv.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.live.js'],
  testTimeout: 30000, // Increased timeout for real API calls
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
