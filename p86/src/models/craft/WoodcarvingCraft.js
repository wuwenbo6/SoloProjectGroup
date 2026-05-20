const mongoose = require('mongoose');
const { connections } = require('../../config/databases');

const woodcarvingCraftSchema = new mongoose.Schema({
  craftCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  craftName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    required: true,
    enum: ['浮雕', '圆雕', '镂空雕', '根雕', '其他'],
  },
  materials: [{
    woodType: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      default: 'kg',
    },
  }],
  tools: [{
    toolName: {
      type: String,
      required: true,
    },
    specification: String,
  }],
  steps: [{
    stepNumber: {
      type: Number,
      required: true,
    },
    stepName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    estimatedTime: {
      type: Number,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['简单', '中等', '困难', '专家'],
      default: '中等',
    },
  }],
  qualityStandards: {
    surfaceSmoothness: String,
    carvingAccuracy: String,
    structuralIntegrity: String,
    finishQuality: String,
  },
  estimatedDuration: {
    type: Number,
    required: true,
  },
  difficultyLevel: {
    type: String,
    enum: ['初级', '中级', '高级', '大师级'],
    default: '中级',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ['草稿', '审核中', '已发布', '已停用'],
    default: '草稿',
  },
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

module.exports = connections.craft.model('WoodcarvingCraft', woodcarvingCraftSchema);