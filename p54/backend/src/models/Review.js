const { DataTypes } = require('sequelize')
const sequelize = require('./index')

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  annotationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '释读ID'
  },
  rubbingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '拓片ID'
  },
  reviewerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '审核人ID'
  },
  reviewType: {
    type: DataTypes.ENUM('character', 'pinyin', 'radical', 'meaning', 'all'),
    defaultValue: 'all',
    comment: '审核类型'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'needs_revision'),
    defaultValue: 'pending',
    comment: '审核状态：待审核、通过、驳回、需修改'
  },
  originalData: {
    type: DataTypes.JSON,
    comment: '原始数据快照'
  },
  suggestedData: {
    type: DataTypes.JSON,
    comment: '建议修改内容'
  },
  comments: {
    type: DataTypes.TEXT,
    comment: '审核意见'
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal',
    comment: '优先级'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    comment: '审核时间'
  },
  isAutoReviewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否AI自动审核'
  },
  confidenceScore: {
    type: DataTypes.FLOAT,
    comment: 'AI审核置信度'
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '审核标签'
  }
}, {
  tableName: 'reviews',
  comment: '释读审核表',
  indexes: [
    {
      name: 'idx_annotation_id',
      fields: ['annotationId']
    },
    {
      name: 'idx_rubbing_id',
      fields: ['rubbingId']
    },
    {
      name: 'idx_reviewer_id',
      fields: ['reviewerId']
    },
    {
      name: 'idx_status',
      fields: ['status']
    },
    {
      name: 'idx_priority',
      fields: ['priority']
    }
  ]
})

module.exports = Review
