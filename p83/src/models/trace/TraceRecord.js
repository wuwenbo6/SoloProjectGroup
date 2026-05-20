const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const traceRecordSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  materialId: {
    type: String,
    required: true,
    index: true
  },
  batchId: {
    type: String,
    index: true
  },
  stage: {
    type: String,
    required: true,
    enum: ['harvest', 'transport', 'storage', 'processing', 'manufacturing', 'quality_check', 'distribution', 'retail']
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  location: {
    country: String,
    province: String,
    city: String,
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  operator: {
    operatorId: String,
    name: String,
    role: String,
    organization: String
  },
  actions: [{
    actionType: String,
    description: String,
    parameters: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  equipment: {
    equipmentId: String,
    name: String,
    calibrationStatus: String
  },
  environmentalConditions: {
    temperature: Number,
    humidity: Number,
    pressure: Number
  },
  previousTraceId: String,
  nextTraceIds: [String],
  status: {
    type: String,
    enum: ['pending', 'completed', 'verified', 'rejected'],
    default: 'pending'
  },
  verification: {
    verifiedBy: String,
    verifiedAt: Date,
    method: String,
    remarks: String
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video', 'certificate']
    },
    url: String,
    name: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  remarks: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

traceRecordSchema.index({ materialId: 1, stage: 1 });
traceRecordSchema.index({ timestamp: -1 });
traceRecordSchema.index({ batchId: 1 });

const conn = getConnection('trace');
module.exports = conn.model('TraceRecord', traceRecordSchema);
