# EarnLLM Development Guide

This guide provides instructions for setting up, running, and testing the EarnLLM application in a local development environment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Data Seeding](#data-seeding)
- [Running the Application](#running-the-application)
- [Manual API Testing](#manual-api-testing)
- [Running Tests](#running-tests)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or later
- **npm**: v8.x or later
- **PostgreSQL**: v14.x or later (running locally or via Docker)

## Environment Setup

1.  **Clone the Repository**

    ```bash
    git clone <repository-url>
    cd EarnLLM
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables**

    Create a `.env` file in the project root by copying the `.env.example` file (if one exists) or creating a new one. Populate it with the following variables:

    ```env
    # Application
    NODE_ENV=development
    PORT=3000
    FRONTEND_URL=http://localhost:3001

    # Database (PostgreSQL)
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=earnllm_dev

    # Security
    JWT_SECRET=a_strong_and_long_secret_for_jwt

    # External APIs (replace with your actual test keys)
    OPENAI_API_KEY=your_openai_api_key
    STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
    STRIPE_TEST_PRICE_ID=your_stripe_pro_plan_price_id # e.g., price_1P7Zqj... 
    ```

    **Note:** For Stripe, use your *test mode* keys. The `STRIPE_TEST_PRICE_ID` can be found in your Stripe dashboard for the 'Pro' plan product.

## Database Setup

1.  **Create the Development Database**

    Using your preferred PostgreSQL client (e.g., `psql`, Postico, DBeaver), create a new database with the name you specified in `DB_NAME` (e.g., `earnllm_dev`).

2.  **Run Database Migrations**

    The project now uses Sequelize migrations to manage the database schema. This ensures the schema is consistent and version-controlled. To build your database schema, run the following command:

    ```bash
    npm run migrate
    ```

    This command executes all pending migration files located in `src/migrations` and creates the necessary tables and relationships.

## Data Seeding

After the database schema has been created via migrations, you can populate it with essential development data by running the following scripts in order.

1.  **Seed Pricing Plans**

    This script inserts the default 'Starter' and 'Pro' pricing plans.

    ```bash
    npm run seed:pricing-plans
    ```

2.  **Seed Language Models**

    This script inserts the default LLM models (e.g., GPT-4, GPT-3.5-Turbo).

    ```bash
    npm run seed:llm-models
    ```

3.  **Seed a Development User**

    This script creates a test user (`test-user@example.com`), assigns them the 'Starter' plan, creates a billing account, and generates an API key.

    ```bash
    npm run seed:dev-user
    ```

    After running this script, **copy the generated API key** from the console output. You will need it for all manual API testing.

## Running the Application

To start the server with automatic restarts on file changes, use:

```bash
npm run dev
```

The server will be running at `http://localhost:3000`.

For production-like execution without file watching, use:

```bash
npm start
```

## Manual API Testing

### Using `curl`

Here is an example `curl` request to test the chat completions endpoint. Replace `YOUR_GENERATED_API_KEY` with the key you copied from the seed script output.

```bash
curl -X POST http://localhost:3000/api/llm/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GENERATED_API_KEY" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, who are you?"}
    ],
    "model": "gpt-4"
  }'
```

### Using Postman

A Postman collection is available in the `postman/` directory to help with manual testing.

1.  **Import the Collection**

    Import the `postman/EarnLLM.postman_collection.json` file into your Postman client.

2.  **Set Up Authorization**

    The API uses a bearer token for authentication. You must set this for the entire collection.

    -   Right-click the **EarnLLM** collection in Postman and select **Edit**.
    -   Navigate to the **Authorization** tab.
    -   Set the **Type** to `Bearer Token`.
    -   In the **Token** field, paste the API key you copied after running the seed script.
    -   Click **Save**.

3.  **Send Requests**

    You can now use the requests in the collection to interact with the API. For example, try the `GET /health` or `POST /api/llm/chat/completions` endpoints.

## Running Tests

-   **Unit & Integration Tests**: Runs all tests except the `live-api` suite. Uses the `earnllm_test` database and mock data.

    ```bash
    npm test
    ```

-   **Live API Tests**: Runs tests against real external APIs (OpenAI, Stripe). Requires a separate `earnllm_live_test` database and valid API keys in your `.env` file. See `TESTING.md` for detailed setup.

    ```bash
    npm run test:live
    ```
