// Mock the models module first
jest.mock('../../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  PricingPlan: {},
  BillingAccount: {},
}));

// Now require the modules
const userService = require('../../../src/services/user.service');
const { User, PricingPlan, BillingAccount } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

describe('User Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return a user profile if the user is found', async () => {
      const userId = 'a-valid-uuid';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Inc.',
        isAdmin: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        PricingPlan: {
          id: 'plan-123',
          name: 'Starter',
          code: 'starter',
          monthlyFee: 0,
          allowBYOM: false,
        },
        BillingAccount: {
          creditBalance: 100,
          tokenUsageThisMonth: 50,
          subscriptionStatus: 'active',
          currentPeriodEnd: new Date(),
        },
      };

      const expectedProfile = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Inc.',
        isAdmin: false,
        createdAt: mockUser.createdAt,
        lastLoginAt: mockUser.lastLoginAt,
        pricingPlan: {
          id: 'plan-123',
          name: 'Starter',
          code: 'starter',
          monthlyFee: 0,
          allowBYOM: false,
        },
        billing: {
          creditBalance: 100,
          tokenUsageThisMonth: 50,
          subscriptionStatus: 'active',
          currentPeriodEnd: mockUser.BillingAccount.currentPeriodEnd,
        },
      };

      User.findByPk.mockResolvedValue(mockUser);

      const result = await userService.getUserProfile(userId);

      expect(User.findByPk).toHaveBeenCalledWith(userId, {
        include: [{ model: PricingPlan }, { model: BillingAccount }],
        attributes: { exclude: ['password'] },
      });
      expect(result).toEqual(expectedProfile);
    });

    it('should throw an error if the user is not found', async () => {
      const userId = 'a-valid-uuid-not-found';
      User.findByPk.mockResolvedValue(null);

      await expect(userService.getUserProfile(userId)).rejects.toThrow(
        new ApiError(404, 'User not found'),
      );
    });
  });
});
