const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LlmModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here if any
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
