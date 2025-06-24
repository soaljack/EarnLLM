const { Client } = require('pg');

const maxRetries = 20;
const retryDelay = 2000; // 2 seconds

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'earnllm_test',
  connectionTimeoutMillis: 5000, // 5 seconds
});

async function connectWithRetry(retries = maxRetries) {
  if (retries === 0) {
    console.error('PostgreSQL connection failed after maximum retries.');
    process.exit(1);
  }

  try {
    console.log('Attempting to connect to PostgreSQL...');
    await client.connect();
    console.log('PostgreSQL connection successful.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error(`Connection attempt failed: ${err.message}. Retrying in ${retryDelay / 1000}s... (${retries - 1} retries left)`);
    await client.end(); // Ensure client is ended before retrying
    setTimeout(() => connectWithRetry(retries - 1), retryDelay);
  }
}

connectWithRetry();
