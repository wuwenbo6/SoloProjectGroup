const mongoose = require('mongoose');

const interpretationRecordSchema = new mongoose.Schema({
  rubbing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rubbing',
    required: true
  },
  characterId: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalText: String,
  newText: {
    type: String,
    required: true
  },
  comment: String,
  action: {
    type: String,
    enum: ['recognize', 'interpret', 'revise', 'confirm', 'reject'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

interpretationRecordSchema.index({ rubbing: 1, characterId: 1, timestamp: -1 });

module.exports = mongoose.model('InterpretationRecord', interpretationRecordSchema);
