const { Sequelize, DataTypes } = require('sequelize');
const UserModelDefinition = require('../../../src/models/user');

// Mock bcrypt for testing BEFORE requiring the model logic that uses it
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcrypt = require('bcryptjs');

describe('User Model', () => {
  let sequelize;
  let User;

  beforeAll(async () => {
    // Setup an in-memory database for testing
    sequelize = new Sequelize('sqlite::memory:');
    // Initialize the User model
    User = UserModelDefinition(sequelize, DataTypes);
    // Sync all models
    await sequelize.sync();
  });

  beforeEach(async () => {
    // Reset mocks and database before each test
    jest.clearAllMocks();
    await User.destroy({ truncate: true });

    // Set default mock implementations
    bcrypt.hash.mockResolvedValue('hashedpassword123');
    bcrypt.compare.mockImplementation((plain, _hashed) => Promise.resolve(plain === 'correct_password'));
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('should create a user with hashed password', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'securepassword123',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Co.',
    };

    const user = await User.create(userData);

    expect(bcrypt.hash).toHaveBeenCalledWith('securepassword123', 10);
    expect(user.password).toBe('hashedpassword123');
    expect(user.email).toBe(userData.email);
    expect(user.isAdmin).toBe(false);
  });

  test('should validate correct password', async () => {
    const user = await User.create({
      email: 'password-test@example.com',
      password: 'any-password-will-be-mocked',
    });

    const isValid = await user.validatePassword('correct_password');
    expect(isValid).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('correct_password', 'hashedpassword123');
  });

  test('should not validate incorrect password', async () => {
    const user = await User.create({
      email: 'password-test2@example.com',
      password: 'any-password-will-be-mocked',
    });

    const isValid = await user.validatePassword('wrong-password');
    expect(isValid).toBe(false);
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashedpassword123');
  });

  test('should rehash password when updated', async () => {
    const user = await User.create({ email: 'update-test@example.com', password: 'original-password' });

    expect(bcrypt.hash).toHaveBeenCalledWith('original-password', 10);
    jest.clearAllMocks(); // Clear the initial create() hash call
    bcrypt.hash.mockResolvedValue('newHashedPassword'); // Set new hash value for update

    await user.update({ password: 'new-password' });

    expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 10);
    expect(user.password).toBe('newHashedPassword');
  });

  test('should not rehash password if not changed', async () => {
    const user = await User.create({ email: 'no-rehash@example.com', password: 'some-password' });

    jest.clearAllMocks();

    await user.update({ firstName: 'Updated' });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(user.firstName).toBe('Updated');
  });

  test('should validate email format', async () => {
    await expect(User.create({
      email: 'not-an-email',
      password: 'password123',
    })).rejects.toThrow('Validation error: Validation isEmail on email failed');
  });
});
