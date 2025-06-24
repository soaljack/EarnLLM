# EarnLLM Testing Guide

This guide provides a comprehensive overview of the testing strategy for the EarnLLM application, instructions for running the different test suites, and best practices for writing new tests.

## Overview

The project has two primary test suites:

1.  **Standard Tests (`npm test`)**: Fast, reliable, and isolated unit and integration tests that run in a fully mocked environment. These are essential for rapid development and CI/CD checks.
2.  **Live API Tests (`npm run test:live`)**: Slower end-to-end integration tests that run against real external services (PostgreSQL, Stripe, OpenAI). These are crucial for verifying real-world behavior before deployment.

## Standard (Mock-Based) Integration Tests

-   **Command**: `npm test`
-   **Database**: **No database connection is made.** All database interactions are simulated by mocking Sequelize models.
-   **External Services**: All external API calls (e.g., Stripe, OpenAI) are mocked using `jest.mock()`.

This mock-based approach is the standard for all integration tests. It ensures that tests are fast, stable, and completely isolated from external dependencies.

### Key Principles for Writing Mock-Based Tests

1.  **Mock External Modules**: Use `jest.mock()` at the top of your test file to replace any modules that make external calls. This includes our own modules like authentication middleware and Sequelize models, as well as third-party libraries like `stripe`.

2.  **Isolate the Test Environment**: Create a new Express app instance within your test file. Only apply the necessary middleware (e.g., `express.json()`) and the specific router you are testing. This avoids loading the entire application and prevents side effects.

3.  **Control the Data**: Mock the return values of model methods (e.g., `User.findByPk.mockResolvedValue(...)`) inside your tests to simulate different scenarios and control the data flow.

4.  **Clear Mocks**: Use `jest.clearAllMocks()` in a `beforeEach` or `afterEach` block to ensure mocks from one test do not leak into another.

### Example Structure

```javascript
/**
 * tests/integration/my-route.test.js
 */
const request = require('supertest');
const express = require('express');
const { User } = require('../../src/models'); // Import models to mock their methods
const myRoutes = require('../../src/routes/my.routes');

// Mock middleware and other external dependencies
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => next()), // Mock implementation
}));

const authMiddleware = require('../../src/middleware/auth.middleware');

describe('My Routes (Mocked)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup an isolated Express app for this test suite
    app = express();
    app.use(express.json());
    app.use('/api/my-route', myRoutes);

    // Mock the user that the authenticateJWT middleware will attach
    const mockUser = { id: 1, email: 'test@example.com' };
    authMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  test('GET /api/my-route should return user data', async () => {
    // Mock the data for this specific test case
    const mockUserData = { id: 1, email: 'test@example.com', name: 'Test User' };
    User.findByPk.mockResolvedValue(mockUserData);

    const response = await request(app).get('/api/my-route/1').expect(200);

    expect(response.body.name).toBe('Test User');
    expect(User.findByPk).toHaveBeenCalledWith('1');
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

-   Write standard, mock-based tests for all new business logic and endpoints.
-   Add live API tests only for the most critical end-to-end user flows.

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
