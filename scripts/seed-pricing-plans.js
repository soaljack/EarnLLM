const { sequelize, PricingPlan } = require('../src/models');
require('dotenv').config();

const plans = [
  {
    name: 'Starter (Free)',
    code: 'starter_free',
    monthlyFee: 0,
    requestsPerMinute: 100,
    description: 'Perfect for testing and getting started.',
  },
  {
    name: 'Pro Plan',
    code: 'pro_monthly',
    monthlyFee: 2000, // $20.00 in cents
    requestsPerMinute: 10000,
    description: 'For power users and production applications.',
  },
  {
    name: 'Earn-as-You-Go',
    code: 'payg',
    monthlyFee: 0,
    requestsPerMinute: 5000,
    description: 'Pay only for what you use.',
  },
];

async function seedPricingPlans() {
  console.log('🌱 Seeding pricing plans...');
  try {
    await sequelize.sync();

    for (const planData of plans) {
      const [plan, created] = await PricingPlan.findOrCreate({
        where: { code: planData.code }, // Use the unique code to find the plan
        defaults: planData,
      });

      if (created) {
        console.log(`✅ Created plan: ${plan.name}`);
      } else {
        console.log(`✅ Plan already exists: ${plan.name}`);
      }
    }

    console.log('✨ Pricing plans seeded successfully!');
  } catch (error) {
    console.error('❌ Failed to seed pricing plans:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seedPricingPlans();
