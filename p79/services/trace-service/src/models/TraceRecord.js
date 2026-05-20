const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { TRACE_STAGES } = require('../../../../shared/constants');

const TraceRecord = sequelize.define('TraceRecord', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  batch_id: { type: DataTypes.UUID, allowNull: false },
  stage: { type: DataTypes.ENUM(...Object.values(TRACE_STAGES)), allowNull: false },
  operator: { type: DataTypes.STRING(100), allowNull: false },
  operator_id: { type: DataTypes.UUID },
  location: { type: DataTypes.JSONB },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  description: { type: DataTypes.TEXT },
  images: { type: DataTypes.JSONB, defaultValue: [] },
  videos: { type: DataTypes.JSONB, defaultValue: [] },
  documents: { type: DataTypes.JSONB, defaultValue: [] },
  temperature: { type: DataTypes.DECIMAL(5, 2) },
  humidity: { type: DataTypes.DECIMAL(5, 2) },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
  signature: { type: DataTypes.TEXT },
  previous_hash: { type: DataTypes.STRING(256) },
  current_hash: { type: DataTypes.STRING(256) }
}, {
  tableName: 'trace_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['batch_id'] }, { fields: ['stage'] }, { fields: ['timestamp'] }]
});

module.exports = TraceRecord;