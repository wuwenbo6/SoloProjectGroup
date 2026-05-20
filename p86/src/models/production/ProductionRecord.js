const mongoose = require('mongoose');
const { connections } = require('../../config/databases');

const productionRecordSchema = new mongoose.Schema({
  recordCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  batchCode: {
    type: String,
    required: true,
  },
  craftId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  craftCode: {
    type: String,
    required: true,
  },
  stepNumber: {
    type: Number,
    required: true,
  },
  stepName: {
    type: String,
    required: true,
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  operatorName: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number,
  },
  parameters: {
    temperature: {
      type: Number,
    },
    humidity: {
      type: Number,
    },
    toolPressure: {
      type: Number,
    },
    carvingDepth: {
      type: Number,
    },
    carvingSpeed: {
      type: Number,
    },
    woodMoisture: {
      type: Number,
    },
  },
  materialsUsed: [{
    materialType: {
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
  toolsUsed: [{
    toolName: {
      type: String,
      required: true,
    },
    usageTime: {
      type: Number,
    },
  }],
  qualityCheck: {
    passed: {
      type: Boolean,
      default: null,
    },
    inspectorId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    inspectionTime: {
      type: Date,
    },
    remarks: {
      type: String,
    },
  },
  status: {
    type: String,
    enum: ['进行中', '已完成', '已返工', '不合格'],
    default: '进行中',
  },
  images: [{
    url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  remarks: {
    type: String,
  },
  parameterHistory: [{
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    updatedByName: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    changes: {
      temperature: Number,
      humidity: Number,
      toolPressure: Number,
      carvingDepth: Number,
      carvingSpeed: Number,
      woodMoisture: Number,
    },
  }],
}, {
  timestamps: true,
});

productionRecordSchema.index({ batchId: 1, stepNumber: 1 });
productionRecordSchema.index({ createdAt: -1 });

module.exports = connections.production.model('ProductionRecord', productionRecordSchema);