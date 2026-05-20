const mongoose = require('mongoose');
const { getConnection } = require('../../config/databases');

const inspectionItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true
  },
  standard: String,
  method: String,
  actualValue: mongoose.Schema.Types.Mixed,
  unit: String,
  result: {
    type: String,
    enum: ['pass', 'fail', 'warning', 'not_tested']
  },
  notes: String
});

const qualityInspectionSchema = new mongoose.Schema({
  inspectionNumber: {
    type: String,
    required: true,
    unique: true
  },
  productionRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionRecord',
    required: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  propSerialNumber: {
    type: String,
    required: true
  },
  inspectionType: {
    type: String,
    enum: ['in_process', 'final', 'spot_check', 'third_party'],
    required: true
  },
  inspectionStage: String,
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  inspectionItems: [inspectionItemSchema],
  overallResult: {
    type: String,
    enum: ['pass', 'fail', 'pending', 're_inspection_required'],
    default: 'pending'
  },
  inspectionDate: {
    type: Date,
    default: Date.now
  },
  notes: String,
  attachments: [String],
  isSynced: {
    type: Boolean,
    default: false
  },
  syncedAt: Date
}, {
  timestamps: true
});

qualityInspectionSchema.index({ inspectionNumber: 1 });
qualityInspectionSchema.index({ productionRecordId: 1 });
qualityInspectionSchema.index({ isSynced: 1 });

const qualityDB = getConnection('qualityDB');
module.exports = qualityDB.model('QualityInspection', qualityInspectionSchema);
