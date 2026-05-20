const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TestingInstitution = sequelize.define('TestingInstitution', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  code: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  api_key: { type: DataTypes.STRING(255), unique: true, allowNull: false },
  certification_no: { type: DataTypes.STRING(100) },
  contact_info: { type: DataTypes.JSONB },
  address: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'suspended', 'revoked'), defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  rate_limit: { type: DataTypes.INTEGER, defaultValue: 1000 }
}, {
  tableName: 'testing_institutions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = TestingInstitution;