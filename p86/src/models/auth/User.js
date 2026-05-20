const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connections } = require('../../config/databases');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  phone: {
    type: String,
  },
  role: {
    type: String,
    required: true,
    enum: ['管理员', '工艺师', '操作员', '质检员', '第三方机构'],
  },
  permissions: [{
    type: String,
  }],
  department: {
    type: String,
  },
  avatar: {
    type: String,
  },
  status: {
    type: String,
    enum: ['正常', '禁用', '待审核'],
    default: '正常',
  },
  lastLogin: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
}, {
  timestamps: true,
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = connections.auth.model('User', userSchema);