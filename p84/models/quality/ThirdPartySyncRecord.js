const mongoose = require('mongoose');
const { getConnection } = require('../../config/databases');

const thirdPartySyncRecordSchema = new mongoose.Schema({
  syncNumber: {
    type: String,
    required: true,
    unique: true
  },
  inspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QualityInspection',
    required: true
  },
  agencyCode: {
    type: String,
    required: true
  },
  agencyName: String,
  syncDirection: {
    type: String,
    enum: ['upload', 'download', 'bidirectional'],
    required: true
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'success', 'failed', 'retrying'],
    default: 'pending'
  },
  requestData: mongoose.Schema.Types.Mixed,
  responseData: mongoose.Schema.Types.Mixed,
  externalReferenceId: String,
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  syncStartedAt: Date,
  syncCompletedAt: Date,
  syncedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

thirdPartySyncRecordSchema.index({ syncNumber: 1 });
thirdPartySyncRecordSchema.index({ inspectionId: 1 });
thirdPartySyncRecordSchema.index({ syncStatus: 1 });

const qualityDB = getConnection('qualityDB');
module.exports = qualityDB.model('ThirdPartySyncRecord', thirdPartySyncRecordSchema);
