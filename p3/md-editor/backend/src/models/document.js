const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema({
  clientId: String,
  operation: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  version: Number
});

const documentSchema = new mongoose.Schema({
  _id: String,
  title: { type: String, default: 'Untitled Document' },
  content: { type: String, default: '' },
  yjsState: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: false },
  ownerId: String,
  changes: [changeSchema],
  currentVersion: { type: Number, default: 0 }
});

documentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Document', documentSchema);
