// Mock dependencies first to ensure they are applied before any other imports
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn(),
  requireAdmin: jest.fn(),
  authenticateApiKey: jest.fn(),
}));

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
  sequelize: {
    // Provide a self-contained transaction mock that simulates the transaction callback pattern.
    transaction: jest.fn().mockImplementation(async (callback) => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      };
      // The callback passed to a transaction is executed with the transaction object.
      return callback(mockTransaction);
    }),
  },
}));

// Mock the jsonwebtoken library
jest.mock('jsonwebtoken');

const request = require('supertest');
const app = require('../../app');
const jwt = require('jsonwebtoken');
const { User, PricingPlan, BillingAccount, sequelize } = require('../../src/models');

describe('Authentication Routes', () => {
  beforeEach(() => {
    // Clear all mocks before each test to ensure a clean state without test pollution.
    jest.resetAllMocks();

    // Mock JWT to return a consistent token for all tests.
    jwt.sign.mockReturnValue('mock-jwt-token');
  });

  describe('POST /api/auth/register', () => {
    const registerPayload = {
      email: 'register-test@example.com',
      password: 'Password123!',
      firstName: 'Register',
      lastName: 'User',
    };

    it('should register a new user, create a billing account, and return a token', async () => {
      const mockNewUser = {
        id: 1,
        ...registerPayload,
        toJSON: () => ({ ...registerPayload, id: 1 }),
      };
      const mockStarterPlan = { id: 1, code: 'starter' };

      // Arrange: Set up mock return values for this specific test case.
      User.findOne.mockResolvedValue(null); // Simulate user does not exist.
      PricingPlan.findOne.mockResolvedValue(mockStarterPlan);
      User.create.mockResolvedValue(mockNewUser);
      BillingAccount.create.mockResolvedValue({ id: 1, UserId: 1 });

      // Act: Send the registration request.
      const response = await request(app).post('/api/auth/register').send(registerPayload).expect(201);

      // Assert: Verify that the correct functions were called and the response is correct.
      expect(User.findOne).toHaveBeenCalledWith({ where: { email: registerPayload.email } });
      expect(PricingPlan.findOne).toHaveBeenCalledWith({ where: { code: 'starter' } });
      expect(User.create).toHaveBeenCalled();
      expect(BillingAccount.create).toHaveBeenCalled();
      expect(response.body.user.email).toBe(registerPayload.email);
      expect(response.body.token).toBe('mock-jwt-token');
    });

    it('should return 409 if user already exists', async () => {
      User.findOne.mockResolvedValue({ id: 1 }); // Simulate user exists.
      await request(app).post('/api/auth/register').send(registerPayload).expect(409);
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange: Simulate a validation error when required fields are missing.
      const validationError = new Error('Validation error: password cannot be null');
      validationError.name = 'SequelizeValidationError'; // Mimic Sequelize's error type.
      validationError.errors = [{ message: 'Password cannot be null' }]; // The error handler expects an 'errors' array.
      User.create.mockRejectedValue(validationError);

      // Also need to mock the preceding calls to prevent other errors.
      User.findOne.mockResolvedValue(null);
      PricingPlan.findOne.mockResolvedValue({ id: 1, code: 'starter' });

      const { password, ...incompletePayload } = registerPayload;

      // Act & Assert
      await request(app).post('/api/auth/register').send(incompletePayload).expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const loginPayload = { email: 'login-test@example.com', password: 'Password123!' };
    let mockUser;

    beforeEach(() => {
      // Create a fresh mock user for each login test.
      mockUser = {
        id: 1,
        isActive: true,
        validatePassword: jest.fn(),
        update: jest.fn(), // Mock the update method called in the controller
        PricingPlan: { id: 1, name: 'Starter', code: 'starter' }, // Mock the nested PricingPlan object
        toJSON: () => ({ id: 1, email: loginPayload.email }),
      };
    });

    it('should log in a valid user and return a token', async () => {
      // Arrange
      mockUser.validatePassword.mockResolvedValue(true);
      User.findOne.mockResolvedValue(mockUser);

      // Act
      const response = await request(app).post('/api/auth/login').send(loginPayload).expect(200);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: loginPayload.email },
        include: [{ model: PricingPlan }],
      });
      expect(mockUser.validatePassword).toHaveBeenCalledWith(loginPayload.password);
      expect(response.body.token).toBe('mock-jwt-token');
    });

    it('should return 401 for an incorrect password', async () => {
      mockUser.validatePassword.mockResolvedValue(false);
      User.findOne.mockResolvedValue(mockUser);
      await request(app).post('/api/auth/login').send(loginPayload).expect(401);
    });

    it('should return 401 for a non-existent user', async () => {
      User.findOne.mockResolvedValue(null);
      await request(app).post('/api/auth/login').send(loginPayload).expect(401);
    });

    it('should return 403 for an inactive user', async () => {
      mockUser.isActive = false;
      User.findOne.mockResolvedValue(mockUser);
      await request(app).post('/api/auth/login').send(loginPayload).expect(403);
    });
  });
});
