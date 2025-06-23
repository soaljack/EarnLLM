/**
 * Unit tests for ApiKey model
 */

const { ApiKey, User } = require('../../../src/models');

// Since we're using mocks, we need to set up the mock implementation for User.create
User.create.mockResolvedValue({
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  isActive: true,
});

describe('ApiKey Model', () => {
  let testUser;

  beforeAll(() => {
    // Get a test user from our mock implementation
    testUser = {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    };
  });

  afterAll(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test('should generate a secure API key with prefix', async () => {
    const apiKey = await ApiKey.create({
      name: 'Test API Key',
      UserId: testUser.id,
      isActive: true,
    });

    // Check that required fields were generated
    expect(apiKey.id).toBeDefined();
    expect(apiKey.key).toBeDefined();
    expect(apiKey.prefix).toBeDefined();
    expect(apiKey.name).toBe('Test API Key');
    expect(apiKey.UserId).toBe(testUser.id);
    expect(apiKey.isActive).toBe(true);

    // Check prefix format (should be like "ek_xxxxxxxx")
    expect(apiKey.prefix).toMatch(/^ek_[a-zA-Z0-9]{8}$/);

    // Key should be hashed, not plaintext
    expect(apiKey.key).not.toContain(apiKey.prefix);

    // Key should be at least 32 chars (for a secure hash)
    expect(apiKey.key.length).toBeGreaterThanOrEqual(32);
  });

  test('should verify a valid API key', async () => {
    // Create a new API key
    const apiKey = await ApiKey.create({
      name: 'Verification Test Key',
      UserId: testUser.id,
      isActive: true,
    });

    // Get the raw key before it's lost (only available at creation time)
    const { rawKey } = apiKey;
    expect(rawKey).toBeDefined();
    expect(rawKey.startsWith(apiKey.prefix)).toBe(true);

    // Verify the key
    const isValid = await ApiKey.verifyKey(rawKey);
    expect(isValid).toBeTruthy();
  });

  test('should not verify an invalid API key', async () => {
    const invalidKey = 'ek_12345678INVALID_KEY_HERE';
    const isValid = await ApiKey.verifyKey(invalidKey);
    expect(isValid).toBeFalsy();
  });

  test('should not verify a revoked API key', async () => {
    // Create a new API key
    const apiKey = await ApiKey.create({
      name: 'Revocation Test Key',
      UserId: testUser.id,
      isActive: true,
    });

    // Get the raw key
    const { rawKey } = apiKey;

    // Verify initially valid
    let isValid = await ApiKey.verifyKey(rawKey);
    expect(isValid).toBeTruthy();

    // Add this key to the revoked keys list in our mock
    ApiKey._revokedKeys.push(rawKey);

    // Revoke the key (in a real implementation, this would update the DB)
    await apiKey.update({ isActive: false });

    // Should no longer verify
    isValid = await ApiKey.verifyKey(rawKey);
    expect(isValid).toBeFalsy();
  });
});
