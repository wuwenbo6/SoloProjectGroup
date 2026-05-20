const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const testingAgencySchema = new mongoose.Schema({
  agencyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  licenseType: String,
  licenseIssueDate: Date,
  licenseExpiryDate: Date,
  accreditationBody: String,
  address: {
    country: String,
    province: String,
    city: String,
    street: String,
    postalCode: String
  },
  contactPerson: {
    name: String,
    position: String,
    email: String,
    phone: String
  },
  apiConfig: {
    baseUrl: String,
    apiKey: String,
    authType: {
      type: String,
      enum: ['api_key', 'oauth2', 'basic_auth', 'bearer_token'],
      default: 'api_key'
    },
    username: String,
    password: String,
    token: String,
    tokenExpiry: Date,
    timeout: {
      type: Number,
      default: 30000
    }
  },
  capabilities: [{
    type: String,
    description: String,
    standards: [String],
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  supportedTestTypes: [String],
  certificationScope: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval'],
    default: 'pending_approval'
  },
  syncSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    syncFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly', 'manual'],
      default: 'realtime'
    },
    autoSyncQualityData: {
      type: Boolean,
      default: false
    },
    autoSyncCertificates: {
      type: Boolean,
      default: false
    },
    webhookEnabled: {
      type: Boolean,
      default: false
    },
    webhookUrl: String,
    webhookSecret: String
  },
  lastSyncTime: Date,
  lastSyncStatus: String,
  syncStats: {
    totalRecords: {
      type: Number,
      default: 0
    },
    successfulSyncs: {
      type: Number,
      default: 0
    },
    failedSyncs: {
      type: Number,
      default: 0
    }
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  remarks: String,
  attachments: [{
    type: {
      type: String,
      enum: ['license', 'certificate', 'agreement', 'other']
    },
    url: String,
    name: String,
    uploadedAt: Date
  }],
  createdBy: String,
  updatedBy: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  versionKey: false
});

testingAgencySchema.index({ status: 1 });
testingAgencySchema.index({ 'syncSettings.enabled': 1 });
testingAgencySchema.index({ licenseNumber: 1 });

const conn = getConnection('quality');
module.exports = conn.model('TestingAgency', testingAgencySchema);
