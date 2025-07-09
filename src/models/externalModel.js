module.exports = (sequelize, Sequelize) => {
  const { Model, DataTypes } = Sequelize;

  class ExternalModel extends Model {
    /**
     * Defines associations for the ExternalModel model.
     * @param {object} models - The models object containing all initialized models.
     */
    static associate(models) {
      ExternalModel.belongsTo(models.User, { foreignKey: 'UserId' });
    }

    /**
     * Instance method to get the decrypted API key.
     * In a real application, this would decrypt the key.
     */
    getDecryptedApiKey() {
      // In production, you would decrypt the API key here
      // This is a placeholder for actual decryption logic
      return this.apiKey;
    }
  }

  ExternalModel.init({
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
      comment: 'The full URL to the external model API endpoint',
    },
    apiKey: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Encrypted API key for the external model provider',
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
      comment: 'Cost per 1K prompt tokens in cents',
    },
    completionTokenCostInCents: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
      comment: 'Cost per 1K completion tokens in cents',
    },
    contextWindow: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8192,
    },
    requestTemplate: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Custom request template if the external API requires specific formatting',
    },
    responseMapping: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Mapping to transform external API response to EarnLLM standard format',
    },
    headers: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional HTTP headers to include in requests',
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
  }, {
    sequelize,
    modelName: 'ExternalModel',
    timestamps: true,
    hooks: {
      beforeSave: (externalModel) => {
        // In production, you would encrypt the API key here
        // This is a placeholder for actual encryption logic
        if (externalModel.changed('apiKey') && externalModel.apiKey) {
          // In production: externalModel.apiKey = encryptApiKey(externalModel.apiKey);
        }
      },
    },
  });

  return ExternalModel;
};
