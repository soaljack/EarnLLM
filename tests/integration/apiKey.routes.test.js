const jwt = require('jsonwebtoken');
const { startServer, stopServer } = require('./helpers');
const config = require('../../src/config');

describe('API Key Routes', () => {
  const {
    User, ApiKey, BillingAccount, PricingPlan,
  } = global.models;
  let testUser;
  let authToken;
  let serverRequest;

  beforeAll(async () => {
    serverRequest = await startServer();
  });

  beforeEach(async () => {
    // Find the starter plan created in global setup
    const starterPlan = await PricingPlan.findOne({ where: { code: 'starter' } });

    // Create a fresh user for each test to avoid unique constraint errors
    const uniqueEmail = `apikey-test-${Date.now()}@example.com`;
    testUser = await User.create({
      email: uniqueEmail,
      password: 'password123',
      role: 'user',
      PricingPlanId: starterPlan.id,
    });
    await BillingAccount.create({ UserId: testUser.id, PricingPlanId: starterPlan.id });
    authToken = jwt.sign({ id: testUser.id, role: testUser.role }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterEach(async () => {
    // Use truncate to quickly clear all test data and reset sequences
    await User.truncate({ cascade: true, restartIdentity: true });
  });

  afterAll(async () => {
    await stopServer();
  });

  describe('POST /v1/api-keys', () => {
    it('should create a new API key and return it', async () => {
      const keyName = 'My Test Key';
      const res = await serverRequest
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: keyName })
        .expect(201);

      expect(res.body).toHaveProperty('key');
      expect(res.body.key).toMatch(/^sk_[a-zA-Z0-9]{64}$/);
      expect(res.body.name).toBe(keyName);
      expect(res.body.prefix).toBe(res.body.key.substring(0, 10));

      const dbKey = await ApiKey.findOne({ where: { UserId: testUser.id } });
      expect(dbKey).not.toBeNull();
      expect(dbKey.name).toBe(keyName);
    });

    it('should return 400 if name is missing', async () => {
      await serverRequest
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /v1/api-keys', () => {
    it('should retrieve all API keys for the user', async () => {
      await ApiKey.create({
        name: 'Key 1', UserId: testUser.id, key: 'key1_hashed', prefix: 'sk_test_1',
      });
      await ApiKey.create({
        name: 'Key 2', UserId: testUser.id, key: 'key2_hashed', prefix: 'sk_test_2',
      });

      const res = await serverRequest
        .get('/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBe('Key 1');
      expect(res.body[1].name).toBe('Key 2');
      expect(res.body[0]).not.toHaveProperty('key'); // Full key should not be returned
    });
  });

  describe('POST /v1/api-keys/:id/revoke', () => {
    it('should revoke an active API key', async () => {
      const apiKey = await ApiKey.create({
        name: 'Key to Revoke', UserId: testUser.id, key: 'key_to_revoke_hashed', prefix: 'sk_test_rev', isActive: true,
      });

      await serverRequest
        .post(`/v1/api-keys/${apiKey.id}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const revokedKey = await ApiKey.findByPk(apiKey.id);
      expect(revokedKey.isActive).toBe(false);
    });

    it('should return 404 for a non-existent key', async () => {
      await serverRequest
        .post('/v1/api-keys/999999/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 if key belongs to another user', async () => {
      const otherUser = await User.create({
        email: `other-${Date.now()}@example.com`,
        password: 'password',
        PricingPlanId: testUser.PricingPlanId,
      });
      const apiKey = await ApiKey.create({
        name: 'Other User Key', UserId: otherUser.id, key: 'other_key_hashed', prefix: 'sk_test_other',
      });

      await serverRequest
        .post(`/v1/api-keys/${apiKey.id}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /v1/api-keys/:id', () => {
    it('should delete an API key', async () => {
      const apiKey = await ApiKey.create({
        name: 'Key to Delete', UserId: testUser.id, key: 'key_to_delete_hashed', prefix: 'sk_test_del',
      });

      await serverRequest
        .delete(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deletedKey = await ApiKey.findByPk(apiKey.id);
      expect(deletedKey).toBeNull();
    });

    it('should return 404 for a non-existent key', async () => {
      await serverRequest
        .delete('/v1/api-keys/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /v1/api-keys/:id', () => {
    it('should update the name of an API key', async () => {
      const apiKey = await ApiKey.create({
        name: 'Key to Update', UserId: testUser.id, key: 'key_to_update_hashed', prefix: 'sk_test_upd',
      });
      const newName = 'Updated Key Name';

      const res = await serverRequest
        .put(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName })
        .expect(200);

      expect(res.body.name).toBe(newName);

      const updatedKey = await ApiKey.findByPk(apiKey.id);
      expect(updatedKey.name).toBe(newName);
    });

    it('should return 404 for a non-existent key', async () => {
      await serverRequest
        .put('/v1/api-keys/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should return 404 if key belongs to another user', async () => {
      const otherUser = await User.create({
        email: `other-${Date.now()}@example.com`,
        password: 'password',
        PricingPlanId: testUser.PricingPlanId,
      });
      const apiKey = await ApiKey.create({
        name: 'Other User Key', UserId: otherUser.id, key: 'other_key_hashed', prefix: 'sk_test_other',
      });

      await serverRequest
        .put(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });
  });
});
