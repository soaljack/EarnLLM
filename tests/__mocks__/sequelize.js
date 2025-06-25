const actualSequelize = jest.requireActual('sequelize');

// Factory function to create a new mock model object
const createMockModel = () => ({
  init: jest.fn(),
  associate: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
});

// A mock sequelize instance that returns a new mock model for each definition
const mockSequelize = {
  define: jest.fn(() => createMockModel()),
  authenticate: jest.fn().mockResolvedValue(),
  sync: jest.fn().mockResolvedValue(),
  close: jest.fn().mockResolvedValue(),
  transaction: jest.fn(async (cb) => cb()),
  model: jest.fn(() => createMockModel()),
};

// The main Sequelize mock that returns our mock instance
const Sequelize = jest.fn(() => mockSequelize);

// Copy static properties from the actual sequelize library
Sequelize.Op = actualSequelize.Op;
Sequelize.DataTypes = actualSequelize.DataTypes;
Sequelize.Model = class Model {}; // A dummy class for `extends Model` to work

module.exports = {
  Sequelize,
  Op: actualSequelize.Op,
  DataTypes: actualSequelize.DataTypes,
};
