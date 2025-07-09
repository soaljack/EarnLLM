const { DataTypes } = require('sequelize');

module.exports = {
  up: async ({ context: { queryInterface } }) => {
    await queryInterface.createTable('BillingAccounts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      stripeCustomerId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      stripeSubscriptionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscriptionStatus: {
        type: DataTypes.ENUM(
          'active',
          'incomplete',
          'incomplete_expired',
          'past_due',
          'canceled',
          'unpaid',
          'trialing',
        ),
        allowNull: true,
      },
      currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      creditBalance: {
        type: DataTypes.INTEGER, // In cents
        defaultValue: 0,
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tokenUsageThisMonth: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      billingEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoiceSettings: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      paymentsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      UserId: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      PricingPlanId: {
        type: DataTypes.UUID,
        references: {
          model: 'PricingPlans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    });
  },

  down: async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('BillingAccounts');
  },
};
