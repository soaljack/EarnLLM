module.exports = {
  up: async ({ context }) => {
    const { queryInterface, Sequelize } = context;
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('ExternalModels', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      modelId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      apiEndpoint: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      apiKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      capabilities: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: ['chat'],
        allowNull: false,
      },
      promptTokenCostInCents: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false,
      },
      completionTokenCostInCents: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false,
      },
      contextWindow: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 8192,
      },
      requestTemplate: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      responseMapping: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      headers: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      lastTestedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      testStatus: {
        type: DataTypes.ENUM('success', 'failed', 'pending', 'untested'),
        defaultValue: 'untested',
      },
      testMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
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

  down: async ({ context }) => {
    const { queryInterface } = context;
    await queryInterface.dropTable('ExternalModels');
  },
};
