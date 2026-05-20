const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const materialSchema = new mongoose.Schema({
  materialId: {
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
  type: {
    type: String,
    required: true,
    enum: ['wood', 'bamboo', 'silk', 'leather', 'metal', 'bone', 'other']
  },
  origin: {
    country: { type: String, required: true },
    province: String,
    city: String,
    region: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  characteristics: {
    density: Number,
    hardness: Number,
    moistureContent: Number,
    color: String,
    texture: String,
    grainPattern: String
  },
  supplier: {
    supplierId: String,
    name: String,
    contact: String,
    licenseNumber: String
  },
  harvestDate: Date,
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C', 'D']
  },
  storageConditions: {
    temperature: Number,
    humidity: Number,
    location: String
  },
  status: {
    type: String,
    enum: ['available', 'used', 'reserved', 'expired'],
    default: 'available'
  },
  batchId: {
    type: String,
    index: true
  },
  processBindings: [{
    processName: { type: String, required: true },
    processDetails: {
      duration: String,
      equipment: [String],
      qualityImpact: String,
      cost: Number
    },
    createdAt: { type: Date, default: Date.now },
    createdBy: String,
    updatedAt: { type: Date, default: Date.now },
    updatedBy: String
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

materialSchema.index({ 'origin.country': 1, type: 1 });
materialSchema.index({ createdAt: -1 });

const conn = getConnection('material');
module.exports = conn.model('Material', materialSchema);
