const mongoose = require('mongoose');
const { getConnection } = require('../../config/databases');

const processStepSchema = new mongoose.Schema({
  stepName: {
    type: String,
    required: true
  },
  stepOrder: {
    type: Number,
    required: true
  },
  description: String,
  parameters: [{
    name: String,
    unit: String,
    minValue: Number,
    maxValue: Number,
    required: Boolean
  }],
  estimatedDuration: Number,
  requiredTools: [String]
});

const processTemplateSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    unique: true
  },
  propType: {
    type: String,
    required: true,
    enum: ['costume', 'headwear', 'weapon', 'props', 'other']
  },
  propName: {
    type: String,
    required: true
  },
  description: String,
  version: {
    type: String,
    default: '1.0'
  },
  steps: [processStepSchema],
  materials: [{
    name: String,
    quantity: Number,
    unit: String,
    specification: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const processDB = getConnection('processDB');
module.exports = processDB.model('ProcessTemplate', processTemplateSchema);
