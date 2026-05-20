const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String
  },
  collectedPatterns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pattern'
  }],
  editedPatterns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pattern'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
