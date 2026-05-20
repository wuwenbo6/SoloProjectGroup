const mongoose = require('mongoose');
const { connections } = require('../../config/databases');

const batchSchema = new mongoose.Schema({
  batchCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  craftId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  craftCode: {
    type: String,
    required: true,
  },
  craftName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  startDate: {
    type: Date,
    required: true,
  },
  estimatedEndDate: {
    type: Date,
    required: true,
  },
  actualEndDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['待开始', '进行中', '已完成', '已暂停', '已取消'],
    default: '待开始',
  },
  priority: {
    type: String,
    enum: ['低', '中', '高', '紧急'],
    default: '中',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  workshop: {
    type: String,
    required: true,
  },
  remarks: {
    type: String,
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  progressMilestones: [{
    milestoneName: {
      type: String,
      required: true,
    },
    milestoneDescription: String,
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
    completedBy: mongoose.Schema.Types.ObjectId,
    notes: String,
  }],
}, {
  timestamps: true,
});

module.exports = connections.production.model('Batch', batchSchema);