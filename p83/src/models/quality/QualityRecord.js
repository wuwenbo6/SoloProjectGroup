const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const qualityRecordSchema = new mongoose.Schema({
  qualityId: {
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
  traceId: String,
  inspectionType: {
    type: String,
    required: true,
    enum: ['incoming', 'process', 'final', 'third_party', 'sampling']
  },
  inspector: {
    inspectorId: String,
    name: String,
    department: String,
    qualification: String
  },
  testingAgency: {
    agencyId: String,
    name: String,
    licenseNumber: String,
    isThirdParty: {
      type: Boolean,
      default: false
    }
  },
  inspectionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  testItems: [{
    itemName: {
      type: String,
      required: true
    },
    standard: String,
    testMethod: String,
    measuredValue: mongoose.Schema.Types.Mixed,
    unit: String,
    tolerance: String,
    result: {
      type: String,
      enum: ['pass', 'fail', 'pending'],
      default: 'pending'
    },
    remarks: String
  }],
  overallResult: {
    type: String,
    required: true,
    enum: ['pass', 'fail', 'conditional', 'pending'],
    default: 'pending'
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100
  },
  defects: [{
    defectType: String,
    severity: {
      type: String,
      enum: ['critical', 'major', 'minor', 'cosmetic']
    },
    description: String,
    location: String,
    quantity: Number
  }],
  equipment: [{
    equipmentId: String,
    name: String,
    calibrationDate: Date,
    calibrationStatus: String
  }],
  environmentalConditions: {
    temperature: Number,
    humidity: Number,
    lightIntensity: Number
  },
  samples: [{
    sampleId: String,
    sampleLocation: String,
    sampleSize: Number,
    samplingMethod: String
  }],
  certificates: [{
    certificateId: String,
    certificateType: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    fileUrl: String
  }],
  reportUrl: String,
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified', 'approved', 'rejected'],
    default: 'draft'
  },
  verification: {
    verifiedBy: String,
    verifiedAt: Date,
    comments: String
  },
  approval: {
    approvedBy: String,
    approvedAt: Date,
    comments: String
  },
  syncedToThirdParty: {
    type: Boolean,
    default: false
  },
  thirdPartySyncTime: Date,
  thirdPartyReferenceId: String,
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  versionKey: false
});

qualityRecordSchema.index({ materialId: 1, inspectionDate: -1 });
qualityRecordSchema.index({ batchId: 1 });
qualityRecordSchema.index({ overallResult: 1 });
qualityRecordSchema.index({ 'testingAgency.isThirdParty': 1 });

const conn = getConnection('quality');
module.exports = conn.model('QualityRecord', qualityRecordSchema);
