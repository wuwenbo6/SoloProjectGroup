const mongoose = require('mongoose');
const { getConnection } = require('../../config/databases');

const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    required: true,
    unique: true
  },
  processTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessTemplate',
    required: true
  },
  propName: {
    type: String,
    required: true
  },
  propType: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  plannedStartDate: Date,
  plannedEndDate: Date,
  actualStartDate: Date,
  actualEndDate: Date,
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'suspended', 'cancelled'],
    default: 'planned'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

batchSchema.index({ batchNumber: 1, status: 1 });

const productionDB = getConnection('productionDB');
module.exports = productionDB.model('Batch', batchSchema);
