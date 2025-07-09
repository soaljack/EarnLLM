const bcrypt = require('bcryptjs');

module.exports = (sequelize, Sequelize) => {
  const { Model, DataTypes } = Sequelize;

  class User extends Model {
    /**
     * Defines associations for the User model.
     * @param {object} models - The models object containing all initialized models.
     */
    static associate(models) {
      User.hasMany(models.ApiKey, { foreignKey: 'UserId' });
      User.hasOne(models.BillingAccount, { foreignKey: 'UserId' });
      User.belongsTo(models.PricingPlan, { foreignKey: 'PricingPlanId' });
      User.hasMany(models.ApiUsage, { foreignKey: 'UserId' });
      User.hasMany(models.ExternalModel, { foreignKey: 'UserId' });
    }

    /**
     * Instance method to validate a password against the user's stored hash.
     * @param {string} password - The password to validate.
     * @returns {Promise<boolean>} True if the password is correct.
     */
    async validatePassword(password) {
      return bcrypt.compare(password, this.password);
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        const userMutable = user;
        if (userMutable.password) {
          userMutable.password = await bcrypt.hash(userMutable.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        const userMutable = user;
        if (userMutable.changed('password')) {
          userMutable.password = await bcrypt.hash(userMutable.password, 10);
        }
      },
    },
  });

  return User;
};
