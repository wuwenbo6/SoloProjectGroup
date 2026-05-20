const mongoose = require('mongoose');
const { connections } = require('../../config/databases');

const parameterAlertSchema = new mongoose.Schema({
  alertCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  productionRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ProductionRecord',
    index: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  craftId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  parameterType: {
    type: String,
    required: true,
    enum: ['temperature', 'humidity', 'toolPressure', 'carvingDepth', 'carvingSpeed', 'woodMoisture'],
  },
  parameterName: {
    type: String,
    required: true,
  },
  currentValue: {
    type: Number,
    required: true,
  },
  thresholdMin: {
    type: Number,
  },
  thresholdMax: {
    type: Number,
  },
  alertLevel: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'danger', 'critical'],
    default: 'warning',
  },
  alertType: {
    type: String,
    required: true,
    enum: ['exceed_upper', 'below_lower', 'abnormal_fluctuation'],
  },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'resolved', 'ignored'],
    default: 'pending',
    index: true,
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  acknowledgedAt: {
    type: Date,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  resolvedAt: {
    type: Date,
  },
  resolutionNotes: {
    type: String,
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  operatorName: {
    type: String,
  },
  notes: {
    type: String,
  },
}, {
  timestamps: true,
});

parameterAlertSchema.index({ createdAt: -1 });
parameterAlertSchema.index({ status: 1, alertLevel: 1 });

module.exports = connections.production.model('ParameterAlert', parameterAlertSchema);
