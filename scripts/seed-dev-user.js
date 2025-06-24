const {
  sequelize,
  User,
  ApiKey,
  PricingPlan,
  BillingAccount,
} = require('../src/models');
require('dotenv').config();

/**
 * This script creates a standard development user and generates an API key for them.
 * It's idempotent, meaning you can run it multiple times without creating duplicate users.
 */
async function seedDevUser() {
  try {
    // Ensure the database schema is up-to-date
    await sequelize.sync();

    const email = 'test-user@example.com';
    const password = 'password123';

    // Find or create the user. The password will be hashed by the User model's beforeCreate hook.
    const starterPlan = await PricingPlan.findOne({ where: { code: 'starter_free' } });
    if (!starterPlan) {
      console.error('❌ Starter plan not found. Please run the seed-pricing-plans.js script first.');
      return;
    }

    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        password,
        isActive: true,
        PricingPlanId: starterPlan.id,
      },
    });

    if (created) {
      console.log(`✅ User created successfully: ${user.email}`);
    } else {
      console.log(`✅ User already exists: ${user.email}`);
      // Ensure the existing user is associated with the starter plan
      if (user.PricingPlanId !== starterPlan.id) {
        console.log('ℹ️  Updating user with Starter plan...');
        user.PricingPlanId = starterPlan.id;
        await user.save();
      }
    }

    // Find or create a billing account for the user
    const [_billingAccount, billingCreated] = await BillingAccount.findOrCreate({
      where: { UserId: user.id },
      defaults: {
        subscriptionStatus: 'active', // A sensible default for a free plan
        billingEmail: user.email,
      },
    });

    if (billingCreated) {
      console.log(`✅ Billing account created for ${user.email}`);
    } else {
      console.log(`✅ Billing account already exists for ${user.email}`);
    }

    // Always generate a new key for simplicity, or find an existing one.
    // The new generateKey method handles creation, so we just call it.
    const { fullKey, newApiKey } = await ApiKey.generateKey(user.id, 'Dev Test Key');

    if (newApiKey) {
      console.log('✅ New API key generated!');
      console.log('🔑 Your API Key (save this, it will not be shown again):');
      console.log(`\n${fullKey}\n`);
    } else {
      console.log('ℹ️  API key already exists for this user.');
    }

    console.log('\n--- User Details for Local Testing ---');
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${password}`);
    console.log('------------------------------------');
  } catch (error) {
    console.error('❌ Failed to seed development user:', error);
    process.exit(1);
  } finally {
    // Close the database connection to allow the script to exit.
    await sequelize.close();
  }
}

seedDevUser();
