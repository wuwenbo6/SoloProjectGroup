const bcrypt = require('bcryptjs')

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    realName: {
      type: DataTypes.STRING
    },
    role: {
      type: DataTypes.ENUM('admin', 'expert', 'annotator', 'viewer'),
      defaultValue: 'viewer'
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended'),
      defaultValue: 'active'
    }
  }, {
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10)
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10)
        }
      }
    }
  })

  User.prototype.validPassword = async function (password) {
    return bcrypt.compare(password, this.password)
  }

  User.associate = (models) => {
    User.hasMany(models.Rubbing, { foreignKey: 'uploaderId' })
    User.hasMany(models.Annotation, { foreignKey: 'annotatorId' })
    User.hasMany(models.OperationLog, { foreignKey: 'userId' })
  }

  return User
}
