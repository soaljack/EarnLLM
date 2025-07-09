module.exports = {
  up: async ({ context }) => {
    const { queryInterface, Sequelize } = context;
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('ApiUsages', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      requestId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      totalTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      processingTimeMs: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      promptCostCents: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0,
      },
      completionCostCents: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0,
      },
      totalCostCents: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0,
      },
      clientIp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      succeeded: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      externalModelId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      UserId: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ApiKeyId: {
        type: DataTypes.UUID,
        references: {
          model: 'ApiKeys',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      LlmModelId: {
        type: DataTypes.UUID,
        references: {
          model: 'LlmModels',
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

    await queryInterface.addIndex('ApiUsages', ['createdAt']);
    await queryInterface.addIndex('ApiUsages', ['UserId']);
    await queryInterface.addIndex('ApiUsages', ['requestId']);
  },

  down: async ({ context }) => {
    const { queryInterface } = context;
    await queryInterface.dropTable('ApiUsages');
  },
};
