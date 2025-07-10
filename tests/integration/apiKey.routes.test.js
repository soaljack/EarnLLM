const request = require('supertest');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const config = require('../../src/config');

const { connectRateLimiter, closeRateLimiter } = require('../../src/middleware/rateLimit.middleware');
const { mockRedisClient } = require('../setup');

describe('API Key Routes', () => {
  const {
    User, ApiKey, BillingAccount, PricingPlan,
  } = global.models;
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => { server.listen(resolve); });

    // Mock Redis
    mockRedisClient.isReady = true;
    mockRedisClient.quit = jest.fn().mockResolvedValue('OK');
    mockRedisClient.connect = jest.fn().mockResolvedValue();
    mockRedisClient.on = jest.fn();
    await connectRateLimiter(mockRedisClient);
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
    // Clean up all data created for the test
    await ApiKey.destroy({ where: {} });
    await BillingAccount.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll((done) => {
    if (server) {
      server.close(async () => {
        await closeRateLimiter();
        done();
      });
    } else {
      done();
    }
  });

  describe('POST /v1/api-keys', () => {
    it('should create a new API key and return it', async () => {
      const keyName = 'My Test Key';
      const res = await request(server)
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
      await request(server)
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /v1/api-keys', () => {
    it('should retrieve all API keys for the user', async () => {
      await ApiKey.create({ name: 'Key 1', UserId: testUser.id, key: 'key1_hashed' });
      await ApiKey.create({ name: 'Key 2', UserId: testUser.id, key: 'key2_hashed' });

      const res = await request(server)
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
        name: 'Key to Revoke', UserId: testUser.id, key: 'key_to_revoke_hashed', isActive: true,
      });

      await request(server)
        .post(`/v1/api-keys/${apiKey.id}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const revokedKey = await ApiKey.findByPk(apiKey.id);
      expect(revokedKey.isActive).toBe(false);
    });

    it('should return 404 for a non-existent key', async () => {
      await request(server)
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
      const apiKey = await ApiKey.create({ name: 'Other User Key', UserId: otherUser.id, key: 'other_key_hashed' });

      await request(server)
        .post(`/v1/api-keys/${apiKey.id}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /v1/api-keys/:id', () => {
    it('should delete an API key', async () => {
      const apiKey = await ApiKey.create({ name: 'Key to Delete', UserId: testUser.id, key: 'key_to_delete_hashed' });

      await request(server)
        .delete(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deletedKey = await ApiKey.findByPk(apiKey.id);
      expect(deletedKey).toBeNull();
    });

    it('should return 404 for a non-existent key', async () => {
      await request(server)
        .delete('/v1/api-keys/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /v1/api-keys/:id', () => {
    it('should update the name of an API key', async () => {
      const apiKey = await ApiKey.create({ name: 'Key to Update', UserId: testUser.id, key: 'key_to_update_hashed' });
      const newName = 'Updated Key Name';

      const res = await request(server)
        .put(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName })
        .expect(200);

      expect(res.body.name).toBe(newName);

      const updatedKey = await ApiKey.findByPk(apiKey.id);
      expect(updatedKey.name).toBe(newName);
    });

    it('should return 404 for a non-existent key', async () => {
      await request(server)
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
      const apiKey = await ApiKey.create({ name: 'Other User Key', UserId: otherUser.id, key: 'other_key_hashed' });

      await request(server)
        .put(`/v1/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });
  });
});
