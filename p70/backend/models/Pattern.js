const mongoose = require('mongoose');

const patternSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  imageUrl: {
    type: String,
    required: true
  },
  outlineData: {
    type: Array,
    default: []
  },
  outlineVersion: {
    type: Number,
    default: 0
  },
  colors: [{
    hex: String,
    rgb: { r: Number, g: Number, b: Number },
    percentage: Number
  }],
  features: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  featureVector: {
    type: [Number],
    default: []
  },
  category: {
    type: String,
    default: '未分类'
  },
  tags: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastEditedAt: {
    type: Date,
    default: Date.now
  },
  editLock: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    acquiredAt: Date,
    expiresAt: Date
  },
  similarityScores: [{
    patternId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pattern' },
    score: Number
  }]
}, {
  timestamps: true
});

patternSchema.index({ featureVector: '2dsphere' });

module.exports = mongoose.model('Pattern', patternSchema);
