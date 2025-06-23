/**
 * Integration tests for analytics routes
 */

const request = require('supertest');
const testApp = require('../testApp');

describe('Analytics Routes', () => {
  // Access the app object properly
  const { app } = testApp;

  // Mock tokens for authentication that match expected values in testApp.js
  const adminToken = 'mock_token_for_999';
  const userToken = 'mock_token_for_1';

  describe('GET /api/analytics/overview', () => {
    test('should return overview data for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('usageSummary');
      expect(response.body.usageSummary).toHaveProperty('totalUsers');
      expect(response.body.usageSummary).toHaveProperty('activeUsersToday');
      expect(response.body.usageSummary).toHaveProperty('totalTokensToday');
      expect(response.body.usageSummary).toHaveProperty('totalRequestsToday');
      expect(response.body.usageSummary).toHaveProperty('totalRevenueToday');
    });

    test('should not allow regular users to access', async () => {
      await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/analytics/overview')
        .expect(401);
    });
  });

  describe('GET /api/analytics/user-growth', () => {
    test('should return user growth data for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/user-growth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyGrowth');
      expect(response.body.dailyGrowth).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('cumulativeGrowth');
      expect(response.body.cumulativeGrowth).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('planDistribution');
      expect(response.body.planDistribution).toBeInstanceOf(Array);
    });

    test('should not allow regular users to access', async () => {
      await request(app)
        .get('/api/analytics/user-growth')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/analytics/revenue', () => {
    test('should return revenue data for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyRevenue');
      expect(response.body.dailyRevenue).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('mrr');
      expect(response.body.mrr).toHaveProperty('current');
      expect(response.body).toHaveProperty('arpu');
      expect(response.body).toHaveProperty('planRevenue');
      expect(response.body.planRevenue).toBeInstanceOf(Array);
    });

    test('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyRevenue');
      expect(response.body).toHaveProperty('startDate', startDate);
      expect(response.body).toHaveProperty('endDate', endDate);
    });

    test('should not allow regular users to access', async () => {
      await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/analytics/usage-metrics', () => {
    test('should return usage metrics for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/usage-metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyTokenUsage');
      expect(response.body.dailyTokenUsage).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('modelDistribution');
      expect(response.body.modelDistribution).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('endpointDistribution');
      expect(response.body.endpointDistribution).toBeInstanceOf(Array);
    });

    test('should not allow regular users to access', async () => {
      await request(app)
        .get('/api/analytics/usage-metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
