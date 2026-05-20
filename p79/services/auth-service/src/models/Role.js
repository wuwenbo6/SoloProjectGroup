const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.ENUM(...Object.values(ROLES)),
    allowNull: false,
    unique: true
  },
  permissions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Role;
