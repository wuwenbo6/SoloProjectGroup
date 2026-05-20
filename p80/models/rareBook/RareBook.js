const { DataTypes } = require('sequelize');
const { rareBookDB } = require('../../config/databases');

const RareBook = rareBookDB.define('RareBook', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '古籍编号'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '书名'
  },
  author: {
    type: DataTypes.STRING(100),
    comment: '作者'
  },
  dynasty: {
    type: DataTypes.STRING(50),
    comment: '朝代'
  },
  edition: {
    type: DataTypes.STRING(100),
    comment: '版本'
  },
  material: {
    type: DataTypes.STRING(100),
    comment: '材质'
  },
  dimensions: {
    type: DataTypes.STRING(100),
    comment: '尺寸'
  },
  pages: {
    type: DataTypes.INTEGER,
    comment: '页数'
  },
  condition: {
    type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'damaged'),
    defaultValue: 'fair',
    comment: '保存状况'
  },
  location: {
    type: DataTypes.STRING(200),
    comment: '收藏位置'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '详细描述'
  },
  images: {
    type: DataTypes.JSON,
    comment: '图片URL数组'
  },
  status: {
    type: DataTypes.ENUM('available', 'in_restoration', 'archived', 'on_display'),
    defaultValue: 'available',
    comment: '当前状态'
  },
  traceId: {
    type: DataTypes.STRING(100),
    comment: '追溯链ID'
  },
  createdBy: {
    type: DataTypes.UUID,
    comment: '创建人ID'
  },
  updatedBy: {
    type: DataTypes.UUID,
    comment: '更新人ID'
  }
}, {
  tableName: 'rare_books',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['bookCode'] },
    { fields: ['status'] },
    { fields: ['dynasty'] }
  ]
});

module.exports = RareBook;
