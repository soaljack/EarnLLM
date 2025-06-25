const actualSequelize = jest.requireActual('sequelize');

// A mock model object that has jest.fn() for all the static methods
const mockModel = {
  init: jest.fn(),
  associate: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
};

// A mock sequelize instance that returns our mock model
const mockSequelize = {
  define: jest.fn(() => mockModel),
  authenticate: jest.fn().mockResolvedValue(),
  sync: jest.fn().mockResolvedValue(),
  close: jest.fn().mockResolvedValue(),
  transaction: jest.fn(async (cb) => cb()),
  model: jest.fn(() => mockModel),
};

// The main Sequelize mock that returns our mock instance
const Sequelize = jest.fn(() => mockSequelize);

// Copy static properties from the actual sequelize library
Sequelize.Op = actualSequelize.Op;
Sequelize.DataTypes = actualSequelize.DataTypes;
Sequelize.Model = class Model {}; // A dummy class for `extends Model` to work

module.exports = { Sequelize };
