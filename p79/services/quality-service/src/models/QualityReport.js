const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { QUALITY_GRADES } = require('../../../../shared/constants');

const QualityReport = sequelize.define('QualityReport', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  batch_id: { type: DataTypes.UUID, allowNull: false },
  report_no: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  grade: { type: DataTypes.ENUM(...QUALITY_GRADES), allowNull: false },
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  indicators: { type: DataTypes.JSONB, allowNull: false },
  details: { type: DataTypes.JSONB, defaultValue: {} },
  standard_version: { type: DataTypes.STRING(50), defaultValue: '1.0' },
  inspector_id: { type: DataTypes.UUID },
  inspector_name: { type: DataTypes.STRING(100) },
  inspected_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  images: { type: DataTypes.JSONB, defaultValue: [] },
  remarks: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'), defaultValue: 'draft' },
  approved_by: { type: DataTypes.UUID },
  approved_at: { type: DataTypes.DATE }
}, {
  tableName: 'quality_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['batch_id'] }, { fields: ['grade'] }, { fields: ['status'] }]
});

module.exports = QualityReport;