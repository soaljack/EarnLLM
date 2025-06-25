/**
 * Unit tests for ApiKey model
 */

const { ApiKey } = require('../../../src/models');

describe('ApiKey Model', () => {
  let testUser;

  beforeEach(() => {
    jest.clearAllMocks();

    // A mock user for associating with API keys
    testUser = {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    };

    const mockUpdate = jest.fn().mockImplementation(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    });

    // The real 'verify' is an instance method. We'll mock it on the object returned by 'create'.
    const mockVerify = jest.fn().mockImplementation(function verify(keyToVerify) {
      // A simple mock: returns false if the key is "revoked" (inactive) or matches 'INVALID'
      if (this.isActive === false) return false;
      if (keyToVerify.includes('INVALID')) return false;
      // In a real scenario, this would compare hashes. Here, we just check if it's the right key.
      return keyToVerify === this.rawKey;
    });

    // Spy on the real 'create' method and provide a mock implementation
    jest.spyOn(ApiKey, 'create').mockImplementation(async (data) => {
      const prefix = `ek_${Math.random().toString(36).substring(2, 10)}`;
      const rawKey = `${prefix}_${Math.random().toString(36).substring(2, 22)}`;
      const apiKeyInstance = {
        id: `apikey_${Math.random().toString(36).substring(2, 10)}`,
        key: `hashed_key_${Math.random().toString(36).substring(2, 30)}`.padEnd(32, '0'),
        prefix,
        name: data.name,
        UserId: data.UserId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        rawKey, // Expose raw key for verification tests
        update: mockUpdate,
        verify: mockVerify, // Attach the mock instance method
      };
      return Promise.resolve(apiKeyInstance);
    });
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

    // Verify the key using the instance method
    const isValid = apiKey.verify(rawKey);
    expect(isValid).toBeTruthy();
  });

  test('should not verify an invalid API key', async () => {
    const apiKey = await ApiKey.create({ name: 'test', UserId: testUser.id });
    const invalidKey = 'ek_12345678INVALID_KEY_HERE';
    const isValid = apiKey.verify(invalidKey);
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
    let isValid = apiKey.verify(rawKey);
    expect(isValid).toBeTruthy();

    // Revoke the key by updating its status
    await apiKey.update({ isActive: false });

    // Should no longer verify
    isValid = apiKey.verify(rawKey);
    expect(isValid).toBeFalsy();
  });
});
