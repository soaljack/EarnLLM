/**
 * Mock JWT and password helpers for authentication tests
 */

const jwt = {
  sign: jest.fn().mockImplementation((payload) => `mock_token_for_${payload.id || 'unknown'}`),
  verify: jest.fn().mockImplementation((token, _secret) => {
    if (token === 'invalid_token') {
      throw new Error('Invalid token');
    }

    // Extract user ID from our mock token format
    const userId = token.replace('mock_token_for_', '');
    return { id: userId };
  }),
};

const bcrypt = {
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockImplementation((password, _hash) => Promise.resolve(password === 'correct_password')),
};

module.exports = {
  jwt,
  bcrypt,
};
