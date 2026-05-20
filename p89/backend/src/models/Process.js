const mongoose = require('mongoose');
const { getConnection } = require('../config/databases');

const processSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['啤酒', '葡萄酒', '威士忌', '清酒', '其他'],
    required: true
  },
  ingredients: [{
    name: String,
    quantity: String,
    unit: String
  }],
  steps: [{
    order: Number,
    title: String,
    description: String,
    duration: String,
    temperature: String
  }],
  images: [{
    type: String
  }],
  videos: [{
    type: String
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Process = getConnection('processDB').model('Process', processSchema);

module.exports = Process;
