const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ApiUsage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ApiUsage.belongsTo(models.ApiKey, { foreignKey: 'apiKeyId' });
      ApiUsage.belongsTo(models.LlmModel, { foreignKey: 'llmModelId' });
    }
  }

  ApiUsage.init({
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
  }, {
    sequelize,
    modelName: 'ApiUsage',
    timestamps: true,
    indexes: [
      {
        fields: ['createdAt'],
      },
      {
        fields: ['UserId'],
      },
      {
        fields: ['requestId'],
      },
    ],
  });

  return ApiUsage;
};
