const mongoose = require('mongoose');
const { getConnection } = require('../../config/databases');

const parameterRecordSchema = new mongoose.Schema({
  paramName: {
    type: String,
    required: true
  },
  paramValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  unit: String,
  recordedAt: {
    type: Date,
    default: Date.now
  }
});

const stepRecordSchema = new mongoose.Schema({
  stepId: String,
  stepName: {
    type: String,
    required: true
  },
  stepOrder: Number,
  startTime: Date,
  endTime: Date,
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  parameters: [parameterRecordSchema],
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'paused'],
    default: 'pending'
  }
});

const productionRecordSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  processTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  propSerialNumber: {
    type: String,
    required: true,
    unique: true
  },
  propName: String,
  steps: [stepRecordSchema],
  currentStep: Number,
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'],
    default: 'not_started'
  },
  startedAt: Date,
  completedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  __v: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: '__v'
});

productionRecordSchema.index({ batchId: 1, propSerialNumber: 1 });

const productionDB = getConnection('productionDB');
module.exports = productionDB.model('ProductionRecord', productionRecordSchema);
