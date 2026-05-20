const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Version', versionSchema);
