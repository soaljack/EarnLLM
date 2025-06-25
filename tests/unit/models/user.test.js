// Mock bcrypt for testing BEFORE requiring the model logic that uses it
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const { User } = require('../../../src/models');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // --- Set default mock implementations for dependencies ---
    bcrypt.hash.mockResolvedValue('hashedpassword123');
    bcrypt.compare.mockImplementation((plain, _hashed) => Promise.resolve(plain === 'correct_password'));

    // --- Mock instance methods that would be on a real Sequelize instance ---

    const mockUpdate = jest.fn().mockImplementation(async function update(values) {
      Object.assign(this, values);
      if (values.password) {
        this.password = await bcrypt.hash(values.password, 10);
      }
      return this;
    });

    const mockValidatePassword = jest.fn().mockImplementation(
      async function validatePassword(password) {
        return bcrypt.compare(password, this.password);
      },
    );

    // --- Spy on the static User.create method ---
    jest.spyOn(User, 'create').mockImplementation(async (userData) => {
      if (userData.email === 'not-an-email') {
        const error = new Error('Validation error: Validation isEmail on email failed');
        error.name = 'SequelizeValidationError';
        return Promise.reject(error);
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const newUser = {
        id: `user_${Math.random().toString(36).substring(2, 9)}`,
        ...userData,
        password: hashedPassword,
        isAdmin: userData.isAdmin || false,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        update: mockUpdate,
        validatePassword: mockValidatePassword,
      };

      return Promise.resolve(newUser);
    });
  });

  test('should create a user with a hashed password', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'securepassword123',
      firstName: 'Test',
      lastName: 'User',
    };

    const user = await User.create(userData);

    expect(bcrypt.hash).toHaveBeenCalledWith('securepassword123', 10);
    expect(user.password).toBe('hashedpassword123');
    expect(user.email).toBe(userData.email);
    expect(user.isAdmin).toBe(false);
  });

  test('should validate the correct password', async () => {
    const user = await User.create({
      email: 'password-test@example.com',
      password: 'any-password-will-be-mocked',
    });

    const isValid = await user.validatePassword('correct_password');

    expect(isValid).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('correct_password', 'hashedpassword123');
  });

  test('should not validate an incorrect password', async () => {
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

    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('newHashedPassword');

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

  test('should reject an invalid email format', async () => {
    await expect(User.create({
      email: 'not-an-email',
      password: 'password123',
    })).rejects.toThrow('Validation error: Validation isEmail on email failed');
  });
});
