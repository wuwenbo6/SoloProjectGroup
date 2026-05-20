const mongoose = require('mongoose');
const { getConnection } = require('../../config/database');

const roleSchema = new mongoose.Schema({
  roleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: String,
  permissions: [{
    module: String,
    actions: [String],
    resource: String
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

roleSchema.index({ code: 1 });
roleSchema.index({ status: 1 });

const conn = getConnection('auth');
module.exports = conn.model('Role', roleSchema);
