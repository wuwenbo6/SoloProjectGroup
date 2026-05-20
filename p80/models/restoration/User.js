const { DataTypes } = require('sequelize');
const { restorationDB } = require('../../config/databases');
const bcrypt = require('bcryptjs');

const User = restorationDB.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码'
  },
  realName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '真实姓名'
  },
  email: {
    type: DataTypes.STRING(100),
    validate: { isEmail: true },
    comment: '邮箱'
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: '电话'
  },
  role: {
    type: DataTypes.ENUM('admin', 'restorer', 'inspector', 'archivist', 'viewer'),
    defaultValue: 'viewer',
    comment: '角色'
  },
  permissions: {
    type: DataTypes.JSON,
    comment: '具体权限列表'
  },
  department: {
    type: DataTypes.STRING(100),
    comment: '所属部门'
  },
  title: {
    type: DataTypes.STRING(100),
    comment: '职称'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
    comment: '状态'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    comment: '最后登录时间'
  },
  avatar: {
    type: DataTypes.STRING(255),
    comment: '头像URL'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  },
  indexes: [
    { fields: ['username'] },
    { fields: ['role'] },
    { fields: ['status'] }
  ]
});

User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;
