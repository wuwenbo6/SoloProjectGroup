const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  charId: String,
  boundingBox: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  recognizedText: String,
  interpretText: String,
  confidence: Number,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'disputed'],
    default: 'pending'
  },
  interpreter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const rubbingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  originalImage: {
    type: String,
    required: true
  },
  processedImage: String,
  characters: [characterSchema],
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'ready', 'completed'],
    default: 'uploaded'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dynasty: String,
  location: String,
  material: String,
  dimensions: {
    width: Number,
    height: Number
  },
  tags: [String],
  progress: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

rubbingSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Rubbing', rubbingSchema);
