const http = require('http');
const supertest = require('supertest');
const app = require('../../app'); // The real Express app
const { connectRateLimiter, closeRateLimiter, getRateLimiterClient } = require('../../src/middleware/rateLimit.middleware');
const { mockRedisClient } = require('../setup'); // ioredis-mock instance

let server;
let request;

/**
 * Starts the server for integration tests if it's not already running.
 * Creates an HTTP server, connects the mock Redis client, and returns a supertest agent.
 */
const startServer = async () => {
  if (server) {
    return request;
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(resolve));

  // Ensure the mock Redis client is connected for rate limiting
  await connectRateLimiter(mockRedisClient);

  request = supertest(server);
  return request;
};

/**
 * Stops the server and cleans up resources after tests.
 * Closes the HTTP server and the mock Redis client connection.
 */
const stopServer = async () => {
  // Disconnect the redis client used by the rate limiter
  if (mockRedisClient && typeof mockRedisClient.quit === 'function') {
    await mockRedisClient.quit();
  }

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    server = null;
    request = null;
  }
};

module.exports = {
  startServer,
  stopServer,
};
