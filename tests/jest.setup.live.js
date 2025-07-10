const http = require('http');
const request = require('supertest');
const enableDestroy = require('server-destroy');
const app = require('../app');
const {
  sequelize,
  User,
  ApiKey,
  PricingPlan,
  BillingAccount,
  LlmModel,
} = require('../src/models');
const {
  connectRateLimiter,
  closeRateLimiter,
} = require('../src/middleware/rateLimit.middleware');

let server;

console.log('LIVE API TEST: Environment loaded:', process.env.NODE_ENV);
console.log('LIVE API TEST: Using database:', process.env.DB_NAME);

// Global setup runs once before all tests in this suite
beforeAll(async () => {
  console.log('LIVE API TEST: Setting up test database connection...');
  try {
    // Authenticate with the database
    await sequelize.authenticate();
    console.log('LIVE API TEST: Database connection established successfully.');

    // Sync database - creates tables based on models.
    // IMPORTANT: Ensure this is a DEDICATED TEST DATABASE
    // Using { force: true } will drop and recreate tables for a clean slate.
    // Consider using migrations for more control in a persistent test DB.
    await sequelize.sync({ force: true });
    console.log('LIVE API TEST: Database synchronized.');

    // Connect to Redis before seeding data and starting the server
    await connectRateLimiter();

    // Seed test user and API key
    console.log('LIVE API TEST: Seeding test user and API key...');
    const testUserEmail = 'testlive@example.com';
    const testUserPassword = 'LiveTestPassword123!';
    global.LIVE_TEST_API_KEY_NAME = 'Live Test Key';

    try {
      // 1. Create a test pricing plan
      const stripePriceId = process.env.STRIPE_TEST_PRICE_ID;
      if (!stripePriceId) {
        throw new Error(
          'STRIPE_TEST_PRICE_ID environment variable is not set. '
            + 'Please set it in your .env file for live tests.',
        );
      }
      const testPlan = await PricingPlan.create({
        name: 'Live Test Plan',
        code: 'live-test-plan',
        stripePriceId,
        requestsPerMinute: 100,
        requestsPerDay: 1000,
        tokenAllowance: 50000,
      });
      global.LIVE_TEST_PLAN_ID = testPlan.id; // Make plan ID available to tests
      console.log(`LIVE API TEST: Created pricing plan: ${testPlan.name}`);

      // 2. Seed a system model
      await LlmModel.create({
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
        isActive: true,
        capabilities: ['chat'],
        basePromptTokenCostInCents: 0.000050,
        baseCompletionTokenCostInCents: 0.000150,
        contextWindow: 16385,
      });
      console.log('LIVE API TEST: Seeded system model: gpt-3.5-turbo');

      // 3. Create a test user associated with the plan
      const user = await User.create({
        email: testUserEmail,
        password: testUserPassword,
        firstName: 'Live',
        lastName: 'User',
        verifiedAt: new Date(), // Mark as verified for simplicity
        isActive: true,
        PricingPlanId: testPlan.id, // Associate user with plan
      });
      console.log(`LIVE API TEST: Created test user with ID: ${user.id}`);

      // 4. Create a billing account for the user
      await BillingAccount.create({
        UserId: user.id,
        creditBalance: 1000, // Give some credits in cents
      });
      console.log(`LIVE API TEST: Created billing account for user ${user.id}`);

      // 5. Create an API key for the user
      const { prefix, fullKey, hashedKey } = ApiKey.generateKey();
      global.LIVE_TEST_API_FULL_KEY = fullKey; // e.g., sk-prefixrandombytes

      const apiKey = await ApiKey.create({
        name: global.LIVE_TEST_API_KEY_NAME,
        key: hashedKey,
        prefix,
        UserId: user.id,
        isActive: true,
      });
      console.log(`LIVE API TEST: Created API key ${apiKey.name} (${apiKey.prefix}...) for user ${user.id}`);
      console.log(`LIVE API TEST: Full API Key for tests (DO NOT LOG IN PRODUCTION): ${fullKey}`);

      // Start server and create a global request agent for tests
      server = http.createServer(app);
      server.listen(0); // Listen on a random free port for testing
      enableDestroy(server); // Enhance the server with .destroy()
      global.testRequest = request(server); // Keep for any tests that still use it
      console.log('LIVE API TEST: Server listening for tests.');
    } catch (error) {
      console.error('LIVE API TEST: Error seeding data:', error);
      process.exit(1);
    }
  } catch (error) {
    console.error('LIVE API TEST: Unable to connect to the database or sync schema:', error);
    process.exit(1); // Exit if DB setup fails
  }
});

// Global teardown runs once after all tests in this suite
afterAll(async () => {
  console.log('LIVE API TEST: Teardown started.');

  // Close the rate limiter connection to prevent hanging
  await closeRateLimiter();

  // Close the server
  if (server) {
    console.log('LIVE API TEST: Destroying server...');
    await new Promise((resolve) => {
      server.destroy(() => {
        console.log('LIVE API TEST: Server destroyed successfully.');
        resolve();
      });
    });
  } else {
    console.log('LIVE API TEST: Server was not running, skipping close.');
  }

  // Close the database connection
  console.log('LIVE API TEST: Closing database connection...');
  await sequelize.close();
  console.log('LIVE API TEST: Database connection closed successfully.');

  console.log('LIVE API TEST: Teardown complete.');
});
