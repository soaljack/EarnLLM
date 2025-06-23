const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const ApiKey = sequelize.define('ApiKey', {
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
    timestamps: true,
  });

  /**
   * Static method to generate a new API key, save it to the database, and return the full key.
   * This is the single source of truth for key creation.
   * @param {string} UserId - The UUID of the user who owns the key.
   * @param {string} name - A descriptive name for the key.
   * @returns {{ fullKey: string, newApiKey: ApiKey }} The full, unhashed key and the new ApiKey instance.
   */
  ApiKey.generateKey = async (UserId, name) => {
    const prefix = crypto.randomBytes(4).toString('hex');
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const fullKeyRaw = `${prefix}${randomBytes}`;
    const hashedKey = crypto.createHash('sha256').update(fullKeyRaw).digest('hex');

    const newApiKey = await ApiKey.create({
      UserId,
      name,
      prefix,
      key: hashedKey,
    });

    return {
      fullKey: `sk-${fullKeyRaw}`,
      newApiKey,
    };
  };

  // Instance method to verify API key
  ApiKey.prototype.verify = function verify(keyToVerify) {
    const hashedInputKey = crypto.createHash('sha256').update(keyToVerify).digest('hex');
    return this.key === hashedInputKey;
  };

  return ApiKey;
};
