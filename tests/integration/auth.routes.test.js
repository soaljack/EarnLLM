const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  PricingPlan: {
    findOne: jest.fn(),
  },
  BillingAccount: {
    create: jest.fn(),
  },
}));

// Import modules under test
const authRoutes = require('../../src/routes/auth.routes');
const { User, PricingPlan, BillingAccount } = require('../../src/models');

// Create a dedicated test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes (Mocked)', () => {
  let mockUser;

  beforeEach(() => {
    jest.resetAllMocks();

    mockUser = {
      id: 'user-uuid-123',
      email: 'test@example.com',
      password: 'hashed_password',
      firstName: 'Test',
      lastName: 'User',
      validatePassword: jest.fn(),
      toJSON: jest.fn().mockReturnValue({ id: 'user-uuid-123', email: 'test@example.com' }),
    };

    // Default mock implementations
    PricingPlan.findOne.mockResolvedValue({ id: 'plan-uuid-starter' });
    BillingAccount.create.mockResolvedValue({ id: 'billing-uuid-123' });
    jwt.sign.mockReturnValue('mock_jwt_token');
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue(mockUser);

      const newUser = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(User.create).toHaveBeenCalled();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBe('mock_jwt_token');
    });

    test('should return 409 if user already exists', async () => {
      User.findOne.mockResolvedValue(mockUser); // User exists

      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with correct credentials', async () => {
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // Correct password

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'correct_password' })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBe('mock_jwt_token');
    });

    test('should return 401 for incorrect password', async () => {
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Incorrect password

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong_password' })
        .expect(401);
    });

    test('should return 401 for non-existent user', async () => {
      User.findOne.mockResolvedValue(null); // No user found

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-found@example.com', password: 'any_password' })
        .expect(401);
    });
  });
});
