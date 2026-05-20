const mongoose = require('mongoose');
const { getConnection } = require('../config/databases');

const answerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  upvotes: {
    type: Number,
    default: 0
  },
  isAccepted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const questionSchema = new mongoose.Schema({
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Process',
    index: true
  },
  stepId: {
    type: Number,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  answers: [answerSchema],
  answerCount: {
    type: Number,
    default: 0
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

questionSchema.index({ processId: 1, stepId: 1 });

const Question = getConnection('interactionDB').model('Question', questionSchema);

module.exports = Question;
