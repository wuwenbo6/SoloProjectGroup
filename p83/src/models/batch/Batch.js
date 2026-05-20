const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batchNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  materialType: {
    type: String,
    required: true,
    enum: ['wood', 'bamboo', 'silk', 'leather', 'metal', 'bone', 'other']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    default: 'kg'
  },
  productionDate: {
    type: Date,
    required: true
  },
  expiryDate: Date,
  origin: {
    country: String,
    province: String,
    city: String,
    region: String
  },
  supplier: {
    supplierId: String,
    name: String,
    contact: String
  },
  warehouse: {
    warehouseId: String,
    name: String,
    location: String
  },
  storageLocation: String,
  qualityStandard: String,
  materials: [{
    materialId: String,
    quantity: Number,
    unit: String
  }],
  parentBatchId: String,
  childBatchIds: [String],
  status: {
    type: String,
    required: true,
    enum: ['planned', 'in_progress', 'completed', 'quality_checking', 'approved', 'rejected', 'shipped', 'received', 'archived'],
    default: 'planned'
  },
  qualityStatus: {
    type: String,
    enum: ['pending', 'pass', 'fail', 'conditional'],
    default: 'pending'
  },
  warningSettings: {
    enableExpiryWarning: {
      type: Boolean,
      default: true
    },
    warningDays: {
      type: Number,
      default: 30
    },
    warningLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    notifyUsers: [String],
    lastWarningTime: Date,
    warningCount: {
      type: Number,
      default: 0
    }
  },
  expiryStatus: {
    type: String,
    enum: ['normal', 'warning', 'expired'],
    default: 'normal'
  },
  currentStage: {
    type: String,
    enum: ['harvest', 'transport', 'storage', 'processing', 'manufacturing', 'quality_check', 'distribution', 'retail']
  },
  traceRecords: [{
    traceId: String,
    stage: String,
    timestamp: Date,
    status: String
  }],
  qualityRecords: [{
    qualityId: String,
    inspectionDate: Date,
    result: String
  }],
  productionLine: String,
  manufacturer: {
    manufacturerId: String,
    name: String,
    address: String
  },
  manager: {
    managerId: String,
    name: String,
    contact: String
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

batchSchema.index({ materialType: 1, status: 1 });
batchSchema.index({ productionDate: -1 });
batchSchema.index({ 'materials.materialId': 1 });

const conn = getConnection('material');
module.exports = conn.model('Batch', batchSchema);
