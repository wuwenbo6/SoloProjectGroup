const mongoose = require('mongoose');
const { getConnection } = require('../config/databases');

const commentSchema = new mongoose.Schema({
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Process',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Process',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

favoriteSchema.index({ userId: 1, processId: 1 }, { unique: true });

const likeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Process',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

likeSchema.index({ userId: 1, processId: 1 }, { unique: true });

const Comment = getConnection('interactionDB').model('Comment', commentSchema);
const Favorite = getConnection('interactionDB').model('Favorite', favoriteSchema);
const Like = getConnection('interactionDB').model('Like', likeSchema);

module.exports = { Comment, Favorite, Like };
