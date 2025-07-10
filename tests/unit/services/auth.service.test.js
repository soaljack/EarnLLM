jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
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
    transaction: jest.fn(),
  },
}));

const jwt = require('jsonwebtoken');
const authService = require('../../../src/services/auth.service');
const ApiError = require('../../../src/utils/ApiError');
const {
  User, BillingAccount, PricingPlan, sequelize,
} = require('../../../src/models');

describe('Auth Service', () => {
  let mockTransaction;

  beforeEach(() => {
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return user info and token', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Inc.',
      };
      const mockUser = { id: 'user-123', ...userData };
      const mockPlan = { id: 'plan-123', code: 'starter', name: 'Starter' };
      const mockToken = 'test-token';

      User.findOne.mockResolvedValue(null);
      PricingPlan.findOne.mockResolvedValue(mockPlan);
      User.create.mockResolvedValue(mockUser);
      BillingAccount.create.mockResolvedValue({});
      jwt.sign.mockReturnValue(mockToken);

      const result = await authService.register(userData);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: userData.email } });
      expect(PricingPlan.findOne).toHaveBeenCalledWith({ where: { code: 'starter' } });
      expect(User.create).toHaveBeenCalledWith({
        ...userData,
        PricingPlanId: mockPlan.id,
      }, { transaction: mockTransaction });
      expect(BillingAccount.create).toHaveBeenCalledWith({
        UserId: mockUser.id,
        billingEmail: userData.email,
        creditBalance: 0,
        tokenUsageThisMonth: 0,
        paymentsEnabled: false,
      }, { transaction: mockTransaction });
      expect(jwt.sign).toHaveBeenCalled();
      expect(result.token).toBe(mockToken);
      expect(result.user.email).toBe(userData.email);
    });

    it('should throw an error if user already exists', async () => {
      const userData = { email: 'test@example.com' };
      User.findOne.mockResolvedValue({ id: 'user-123' });

      await expect(authService.register(userData)).rejects.toThrow(
        new ApiError(409, 'User with this email already exists'),
      );
    });

    it('should throw an error if default pricing plan is not found', async () => {
      const userData = { email: 'test@example.com' };
      User.findOne.mockResolvedValue(null);
      PricingPlan.findOne.mockResolvedValue(null);

      await expect(authService.register(userData)).rejects.toThrow(
        new ApiError(500, 'Unable to find default pricing plan. Please contact support.'),
      );
    });
  });

  describe('login', () => {
    it('should login a user and return user info and token', async () => {
      const loginData = { email: 'test@example.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        ...loginData,
        isActive: true,
        validatePassword: jest.fn().mockResolvedValue(true),
        update: jest.fn(),
        PricingPlan: { id: 'plan-123', name: 'Starter', code: 'starter' },
      };
      const mockToken = 'test-token';

      User.findOne.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue(mockToken);

      const result = await authService.login(loginData);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: loginData.email },
        include: [{ model: PricingPlan }],
      });
      expect(mockUser.validatePassword).toHaveBeenCalledWith(loginData.password);
      expect(mockUser.update).toHaveBeenCalledWith({ lastLoginAt: expect.any(Date) });
      expect(jwt.sign).toHaveBeenCalled();
      expect(result.token).toBe(mockToken);
      expect(result.user.email).toBe(loginData.email);
    });

    it('should throw an error for invalid email', async () => {
      const loginData = { email: 'test@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow(new ApiError(401, 'Invalid email or password'));
    });

    it('should throw an error for an inactive account', async () => {
      const loginData = { email: 'test@example.com', password: 'password123' };
      const mockUser = { ...loginData, isActive: false, validatePassword: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(mockUser);

      await expect(authService.login(loginData)).rejects.toThrow(new ApiError(403, 'Account is inactive'));
    });

    it('should throw an error for an invalid password', async () => {
      const loginData = { email: 'test@example.com', password: 'password123' };
      const mockUser = {
        ...loginData,
        isActive: true,
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockResolvedValue(mockUser);

      await expect(authService.login(loginData)).rejects.toThrow(new ApiError(401, 'Invalid email or password'));
    });
  });

  describe('refreshToken', () => {
    it('should refresh a token and return it', () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const mockToken = 'new-test-token';

      jwt.sign.mockReturnValue(mockToken);

      const result = authService.refreshToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY },
      );
      expect(result.token).toBe(mockToken);
      expect(result.message).toBe('Token refreshed successfully');
    });
  });
});
