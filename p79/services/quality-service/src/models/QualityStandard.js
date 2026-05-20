const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QualityStandard = sequelize.define('QualityStandard', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  version: { type: DataTypes.STRING(50), allowNull: false },
  material_category: { type: DataTypes.STRING(100) },
  indicators: { type: DataTypes.JSONB, allowNull: false },
  weights: { type: DataTypes.JSONB, allowNull: false },
  grade_thresholds: { type: DataTypes.JSONB, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'deprecated'), defaultValue: 'active' },
  created_by: { type: DataTypes.UUID }
}, {
  tableName: 'quality_standards',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['material_category'] }, { fields: ['status'] }]
});

module.exports = QualityStandard;