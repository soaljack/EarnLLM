const { DataTypes } = require('sequelize');

module.exports = {
  up: async ({ context: { queryInterface } }) => {
    await queryInterface.createTable('PricingPlans', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      monthlyFee: {
        type: DataTypes.INTEGER, // Stored in cents
        allowNull: false,
        defaultValue: 0,
      },
      tokenAllowance: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Monthly token allowance, null means unlimited',
      },
      requestsPerDay: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Daily request limit, null means unlimited',
      },
      requestsPerMinute: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Rate limit per minute, null means unlimited',
      },
      featuredModels: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'List of model IDs this plan has access to',
      },
      supportSla: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      allowBYOM: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this plan allows Bring Your Own Model',
      },
      stripeProductId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripePriceId: {
        type: DataTypes.STRING,
        allowNull: true,
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
    await queryInterface.dropTable('PricingPlans');
  },
};
