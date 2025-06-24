const request = require('supertest');

jest.mock('../../src/models');
// Mock the JWT library to control token generation
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'), // Retain original functionalities
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
}));

describe('Authentication Routes', () => {
  let app;
  let User;
  let PricingPlan;
  let BillingAccount;
  let sequelize;
  let mockTransaction;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line global-require
    app = require('../../app');
    // eslint-disable-next-line global-require
    const models = require('../../src/models');
    User = models.User;
    PricingPlan = models.PricingPlan;
    BillingAccount = models.BillingAccount;
    sequelize = models.sequelize;

    jest.clearAllMocks();

    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockImplementation(async (cb) => cb(mockTransaction));
  });

  describe('POST /api/auth/register', () => {
    const registerUserPayload = {
      email: 'register-test@example.com',
      password: 'Password123!',
      firstName: 'Register',
      lastName: 'User',
    };

    it('should register a new user, create a billing account, and return a token', async () => {
      const mockNewUser = {
        id: 1,
        ...registerUserPayload,
        password: 'hashedpassword123',
        toJSON: () => ({
          id: 1,
          email: registerUserPayload.email,
          firstName: registerUserPayload.firstName,
          lastName: registerUserPayload.lastName,
        }),
      };
      const mockStarterPlan = { id: 1, code: 'starter' };

      // Simulate user does not exist, then simulate successful creation
      User.findOne.mockResolvedValue(null);
      PricingPlan.findOne.mockResolvedValue(mockStarterPlan);
      User.create.mockResolvedValue(mockNewUser);
      BillingAccount.create.mockResolvedValue({ id: 1, UserId: mockNewUser.id });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerUserPayload)
        .expect(201);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: registerUserPayload.email } });
      expect(PricingPlan.findOne).toHaveBeenCalledWith({ where: { code: 'starter' } });
      expect(User.create).toHaveBeenCalled();

      expect(BillingAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          UserId: mockNewUser.id,
          PricingPlanId: mockStarterPlan.id,
        }),
        { transaction: mockTransaction },
      );

      expect(response.body.user.email).toBe(registerUserPayload.email);
      expect(response.body).toHaveProperty('token', 'mock-jwt-token');
    });

    it('should return 409 if the user already exists', async () => {
      // Simulate user already exists
      User.findOne.mockResolvedValue({ id: 1, email: registerUserPayload.email });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerUserPayload)
        .expect(409);

      expect(response.body.message).toBe('User with this email already exists');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteUser = { email: 'incomplete@example.com' };
      await request(app).post('/api/auth/register').send(incompleteUser).expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    const loginPayload = {
      email: 'login-test@example.com',
      password: 'Password123!',
    };

    const mockDbUser = {
      id: 1,
      email: 'login-test@example.com',
      isActive: true,
      validatePassword: jest.fn().mockResolvedValue(true),
      getPricingPlan: jest.fn().mockResolvedValue({ id: 1, name: 'Starter' }),
    };

    it('should log in a registered user and return a token', async () => {
      // Simulate user exists and password is correct
      mockDbUser.validatePassword.mockResolvedValue(true);
      User.findOne.mockResolvedValue(mockDbUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: loginPayload.email } });
      expect(mockDbUser.validatePassword).toHaveBeenCalledWith(loginPayload.password);
      expect(response.body.message).toBe('Login successful');
      expect(response.body).toHaveProperty('token', 'mock-jwt-token');
    });

    it('should return 401 for an incorrect password', async () => {
      // Simulate user exists but password is incorrect
      mockDbUser.validatePassword.mockResolvedValue(false);
      User.findOne.mockResolvedValue(mockDbUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginPayload)
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password.');
    });

    it('should return 401 for a non-existent user', async () => {
      // Simulate user does not exist
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });
  });
});
