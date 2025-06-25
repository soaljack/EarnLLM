const crypto = require('crypto');

module.exports = (sequelize, Sequelize) => {
  const { Model, DataTypes } = Sequelize;
  class ApiKey extends Model {
    /**
     * Static method to generate a new API key.
     * This is the single source of truth for key creation.
     * @param {string} UserId - The UUID of the user who owns the key.
     * @param {string} name - A descriptive name for the key.
     * @returns {{ fullKey: string, newApiKey: ApiKey }} The full, unhashed key and
     * the new ApiKey instance.
     */
    static async generateKey(UserId, name) {
      const prefix = crypto.randomBytes(4).toString('hex');
      const randomBytes = crypto.randomBytes(32).toString('hex');
      const fullKeyRaw = `${prefix}${randomBytes}`;
      const hashedKey = crypto.createHash('sha256').update(fullKeyRaw).digest('hex');

      const newApiKey = await this.create({
        UserId,
        name,
        prefix,
        key: hashedKey,
      });

      return {
        fullKey: `sk-${fullKeyRaw}`,
        newApiKey,
      };
    }

    /**
     * Instance method to verify an API key against the stored hash.
     * @param {string} keyToVerify - The raw API key to check.
     * @returns {boolean} True if the key is valid.
     */
    verify(keyToVerify) {
      const hashedInputKey = crypto.createHash('sha256').update(keyToVerify).digest('hex');
      return this.key === hashedInputKey;
    }
  }

  ApiKey.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    prefix: {
      type: DataTypes.STRING(8),
      allowNull: false,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['chat:completion', 'embed'],
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'ApiKey',
    timestamps: true,
  });

  return ApiKey;
};
