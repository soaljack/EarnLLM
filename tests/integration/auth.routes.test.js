const bcrypt = require('bcryptjs');
const { startServer, stopServer } = require('./helpers');

describe('Authentication Routes', () => {
  const { User, BillingAccount, PricingPlan } = global.models;
  let request;

  beforeAll(async () => {
    request = await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  // Clean up users and billing accounts after each test
  afterEach(async () => {
    await BillingAccount.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('POST /v1/auth/register', () => {
    const registerPayload = {
      email: 'integration-test@example.com',
      password: 'Password123!',
      firstName: 'Integration',
      lastName: 'Test',
    };

    it('should register a new user, create a billing account, and return a token', async () => {
      // Act: Send the registration request
      const response = await request
        .post('/v1/auth/register')
        .send(registerPayload)
        .expect(201);

      // Assert: Check that the response contains the user and a token
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(registerPayload.email);

      // Assert: Verify that the user and billing account were created in the database
      const user = await User.findOne({ where: { email: registerPayload.email } });
      expect(user).not.toBeNull();

      const billingAccount = await BillingAccount.findOne({ where: { UserId: user.id } });
      expect(billingAccount).not.toBeNull();
    });

    it('should return 409 if user already exists', async () => {
      // Arrange: Create a user with the same email before the test
      await User.create(registerPayload);

      // Act & Assert: Attempt to register again and expect a conflict error
      await request
        .post('/v1/auth/register')
        .send(registerPayload)
        .expect(409);
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange: Create an incomplete payload
      // eslint-disable-next-line no-unused-vars
      const { password, ...incompletePayload } = registerPayload;

      // Act & Assert: Send the incomplete payload and expect a bad request error
      await request
        .post('/v1/auth/register')
        .send(incompletePayload)
        .expect(400);
    });

    it('should return 500 if the default pricing plan is not found', async () => {
      // Arrange: Ensure no pricing plans exist
      await PricingPlan.destroy({ where: {} });

      // Act & Assert: Attempt to register and expect a server error
      await request
        .post('/v1/auth/register')
        .send(registerPayload)
        .expect(500);
    });
  });

  describe('POST /v1/auth/login', () => {
    const loginPayload = {
      email: 'test-login@example.com',
      password: 'password123',
    };

    beforeEach(async () => {
      // Create a user to test login
      const hashedPassword = await bcrypt.hash(loginPayload.password, 10);
      await User.create({
        email: loginPayload.email,
        password: hashedPassword,
        firstName: 'Login',
        lastName: 'Test',
        isVerified: true, // Assume user is verified for login tests
      });
    });

    it('should log in a registered user and return a token', async () => {
      const response = await request
        .post('/v1/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(loginPayload.email);
    });

    it('should return 401 for incorrect password', async () => {
      await request
        .post('/v1/auth/login')
        .send({ ...loginPayload, password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 for a non-existent user', async () => {
      await request
        .post('/v1/auth/login')
        .send({ ...loginPayload, email: 'nouser@example.com' })
        .expect(401);
    });

    it('should return 400 for missing email', async () => {
      // eslint-disable-next-line no-unused-vars
      const { email, ...payload } = loginPayload;
      await request
        .post('/v1/auth/login')
        .send(payload)
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      // eslint-disable-next-line no-unused-vars
      const { password, ...payload } = loginPayload;
      await request
        .post('/v1/auth/login')
        .send(payload)
        .expect(400);
    });
  });
});
