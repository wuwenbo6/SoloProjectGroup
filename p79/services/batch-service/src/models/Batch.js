const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { BATCH_STATUS } = require('../../../../shared/constants');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  material_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'kg'
  },
  production_date: {
    type: DataTypes.DATEONLY
  },
  expiry_date: {
    type: DataTypes.DATEONLY
  },
  status: {
    type: DataTypes.ENUM(...Object.values(BATCH_STATUS)),
    defaultValue: BATCH_STATUS.CREATED
  },
  current_location: {
    type: DataTypes.JSONB
  },
  quality_grade: {
    type: DataTypes.STRING(10)
  },
  quality_report_id: {
    type: DataTypes.UUID
  },
  remarks: {
    type: DataTypes.TEXT
  },
  attributes: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'batches',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['batch_no'] },
    { fields: ['material_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Batch;