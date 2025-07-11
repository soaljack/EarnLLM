module.exports = (sequelize, Sequelize) => {
  const { Model, DataTypes } = Sequelize;

  class LlmModel extends Model {
    /**
     * Defines associations for the LlmModel model.
     * @param {object} models - The models object containing all initialized models.
     */
    static associate(models) {
      LlmModel.hasMany(models.ApiUsage, { foreignKey: 'LlmModelId' });
    }
  }

  LlmModel.init({
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
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    baseUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    capabilities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['chat'],
      allowNull: false,
    },
    basePromptTokenCostInCents: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    baseCompletionTokenCostInCents: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    contextWindow: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8192,
    },
    markupPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
    },
  }, {
    sequelize,
    modelName: 'LlmModel',
    timestamps: true,
  });

  return LlmModel;
};
