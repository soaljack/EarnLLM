jest.mock('../../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  PricingPlan: {},
  BillingAccount: {},
}));

const userService = require('../../../src/services/user.service');
const models = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

describe('User Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return a user profile if the user is found', async () => {
      const userId = 'a-valid-uuid';
      const mockDate = new Date();
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Inc.',
        isAdmin: false,
        createdAt: mockDate,
        lastLoginAt: mockDate,
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
          currentPeriodEnd: mockDate,
        },
      };

            models.User.findByPk.mockResolvedValue(mockUser);

      const result = await userService.getUserProfile(userId);

            expect(models.User.findByPk).toHaveBeenCalledWith(userId, {
        include: [{ model: PricingPlan }, { model: BillingAccount }],
        attributes: { exclude: ['password'] },
      });

      expect(result).toEqual({
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Inc.',
        isAdmin: false,
        createdAt: mockDate,
        lastLoginAt: mockDate,
        pricingPlan: mockUser.PricingPlan,
        billing: mockUser.BillingAccount,
      });
    });

    it('should throw an error if the user is not found', async () => {
      const userId = 'a-valid-uuid-not-found';
            models.User.findByPk.mockResolvedValue(null);

      await expect(userService.getUserProfile(userId)).rejects.toThrow(
        new ApiError(404, 'User not found'),
      );
    });
  });
});
