# EarnLLM Testing Guide

This guide provides a comprehensive overview of the testing strategy for the EarnLLM application, instructions for running the different test suites, and best practices for writing new tests.

## Overview

The project has two primary test suites:

1.  **Standard Tests (`npm test`)**: Fast-running unit and integration tests that use a mocked environment. These are ideal for rapid development and CI/CD checks.
2.  **Live API Tests (`npm run test:live`)**: Slower end-to-end integration tests that run against real external services (PostgreSQL, Stripe, OpenAI). These are crucial for verifying real-world behavior before deployment.

## Standard Tests

-   **Command**: `npm test`
-   **Database**: Uses an in-memory SQLite database, requiring no external setup.
-   **External Services**: All external API calls (Stripe, OpenAI) are mocked to ensure tests are fast and independent of network conditions.
-   **Setup**: The test environment is configured by `tests/jest.setup.js` and torn down by `tests/jest.teardown.js`.

### Writing Mock-Based Integration Tests

For testing routes in isolation without a live database or the full application stack, follow this mock-based pattern. This approach improves test speed and reliability by removing external dependencies.

**Key Principles:**

1.  **Define Mocks First**: All mock data and mock implementations must be defined at the top of the test file, *before* any `jest.mock()` calls or module imports. This is critical to prevent issues with Jest's module hoisting.
2.  **Mock Entire Modules**: Use `jest.mock()` to replace entire modules, such as `../../src/models` or `../../src/middleware/auth.middleware`.
3.  **Isolate the Test Environment**: Create a new Express app instance within your test file. Only apply the necessary middleware (e.g., `express.json()`) and the specific routes you are testing. This avoids loading the entire application.

**Example Structure:**

```javascript
/**
 * tests/integration/my-route.test.js
 */
const request = require('supertest');
const express = require('express');

// 1. Define Mock Data & Implementations
const mockUser = { id: 1, email: 'test@example.com' };
const mockModels = {
  User: { findByPk: jest.fn().mockResolvedValue(mockUser) },
  // ... other models
};
const mockAuthMiddleware = {
  authenticateJWT: (req, res, next) => {
    req.user = mockUser;
    next();
  },
};

// 2. Mock Modules
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/middleware/auth.middleware', () => mockAuthMiddleware);

// 3. Import the Route (module under test)
const myRoutes = require('../../src/routes/my.routes');

// 4. Set up Test Suite
describe('My Routes (Mocked)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // 5. Create isolated Express app
    app = express();
    app.use(express.json());
    app.use('/api/my-route', myRoutes);
  });

  test('GET /api/my-route should return user data', async () => {
    const response = await request(app)
      .get('/api/my-route')
      .expect(200);
    
    expect(response.body).toHaveProperty('email', 'test@example.com');
    expect(mockModels.User.findByPk).toHaveBeenCalledWith(1);
  });
});
```

## Live API Tests

These tests are critical for ensuring the application functions correctly with real-world infrastructure and APIs. **Proper configuration is essential.**

-   **Command**: `npm run test:live`

### Configuration Steps

1.  **PostgreSQL Database**:
    -   You must have a PostgreSQL server running.
    -   Create a dedicated test database named `earnllm_live_test`.
    -   **WARNING**: The test suite runs `sequelize.sync({ force: true })` on every run, which **completely wipes all data and tables** in this database. Do NOT point it to a database with important data.

2.  **Environment Variables (`.env` file)**:
    -   Create a `.env` file in the project root.
    -   Provide valid credentials for your PostgreSQL database (`DB_USER`, `DB_PASSWORD`, etc.).
    -   Set `DB_NAME=earnllm_live_test`.
    -   Provide a valid **test mode** `STRIPE_SECRET_KEY`.
    -   Provide a valid `OPENAI_API_KEY`.

3.  **Stripe Price ID**:
    -   The live tests require a valid, recurring Price ID from your Stripe test dashboard.
    -   Set this ID as the `STRIPE_TEST_PRICE_ID` variable in your `.env` file.

### How Live Tests Work

-   The `tests/jest.setup.live.js` script orchestrates the entire test run.
-   It connects to the PostgreSQL database and Redis (if configured).
-   It starts a single instance of the Express server for all tests to use.
-   It seeds the database with necessary data, including a test user, API key, and pricing plan.
-   After all tests complete, it gracefully shuts down the server and database connections.

## Writing New Tests

### General Best Practices

-   Write standard tests for new business logic, mocking any dependencies.
-   Add live API tests for new endpoints or to cover critical user flows.

### **IMPORTANT**: Writing Live API Tests

To prevent tests from hanging, all live API integration tests **must** use the globally managed `supertest` agent. This agent is available as `global.testRequest`.

**Correct Usage (prevents hanging):**
```javascript
describe('My New Live API Route', () => {
  test('should do something', async () => {
    const response = await global.testRequest
      .get('/api/my-new-route')
      .set('x-api-key', global.LIVE_TEST_API_FULL_KEY);
    expect(response.status).toBe(200);
  });
});
```

**Incorrect Usage (causes hanging tests):**
```javascript
const request = require('supertest');
const app = require('../src/app'); // Do NOT do this in live tests

describe('My New Live API Route', () => {
  test('should do something', async () => {
    // This creates a new, unmanaged server instance that will hang.
    const response = await request(app).get('/api/my-new-route');
  });
});
```

## Troubleshooting

-   **Tests are hanging**: You are likely not using `global.testRequest` in a live API test. See the section above.
-   **Tests are failing with API key errors**: Ensure your `.env` file is correctly configured and that you are accessing the key via `global.LIVE_TEST_API_FULL_KEY` within the test case itself, not at the top level of the file.
-   **Tests fail with `500 Internal Server Error`**: Check the route handler for unhandled exceptions. For example, ensure you validate request parameters (like UUIDs) before making database queries.
