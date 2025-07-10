/**
 * Mock Sequelize for testing
 */
const { Op } = require('sequelize');

const mockModels = {
  User: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  ApiKey: {
    generateKey: jest.fn(() => ({
      prefix: 'sk-test-mock',
      fullKey: 'sk-test-mock_FULLKEY',
      hashedKey: 'hashedKey',
    })),
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findByPk: jest.fn(),
    verifyKey: jest.fn(),
  },
  LlmModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findByPk: jest.fn(),
  },
  PricingPlan: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findByPk: jest.fn(),
  },
  BillingAccount: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  ApiUsage: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    sum: jest.fn(),
    count: jest.fn(),
    findAndCountAll: jest.fn(),
    destroy: jest.fn(),
  },
  ExternalModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findByPk: jest.fn(),
  },
};

// Mock sequelize instance
const sequelizeMock = {
  authenticate: jest.fn().mockResolvedValue(true),
  sync: jest.fn().mockResolvedValue(true),
  transaction: jest.fn().mockImplementation((callback) => {
    if (callback) {
      const t = { commit: jest.fn(), rollback: jest.fn() };
      return callback(t);
    }
    return Promise.resolve({ commit: jest.fn(), rollback: jest.fn() });
  }),
  close: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue([]),
  define: jest.fn().mockReturnValue({}),
};

// Add model associations and reference the sequelize instance
Object.keys(mockModels).forEach((modelName) => {
  const model = mockModels[modelName];
  model.sequelize = sequelizeMock;
  model.findOrCreate = jest.fn();
  model.belongsTo = jest.fn();
  model.hasMany = jest.fn();
  model.hasOne = jest.fn();
  model.belongsToMany = jest.fn();
});

module.exports = {
  sequelize: sequelizeMock,
  Sequelize: {
    Op,
    Model: class MockModel {},
  },
  User: mockModels.User,
  ApiKey: mockModels.ApiKey,
  LlmModel: mockModels.LlmModel,
  PricingPlan: mockModels.PricingPlan,
  BillingAccount: mockModels.BillingAccount,
  ApiUsage: mockModels.ApiUsage,
  ExternalModel: mockModels.ExternalModel,
};
