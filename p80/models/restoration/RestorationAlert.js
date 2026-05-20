const { DataTypes } = require('sequelize');
const { restorationDB } = require('../../config/databases');

const RestorationAlert = restorationDB.define('RestorationAlert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '善本ID'
  },
  bookCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '善本编号'
  },
  progressId: {
    type: DataTypes.UUID,
    comment: '进度ID'
  },
  alertType: {
    type: DataTypes.ENUM('delay', 'quality', 'material', 'budget', 'safety', 'other'),
    allowNull: false,
    comment: '预警类型'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
    comment: '严重程度'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '预警标题'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '详细描述'
  },
  threshold: {
    type: DataTypes.JSON,
    comment: '阈值配置'
  },
  currentValue: {
    type: DataTypes.STRING(100),
    comment: '当前值'
  },
  expectedValue: {
    type: DataTypes.STRING(100),
    comment: '期望值'
  },
  status: {
    type: DataTypes.ENUM('active', 'acknowledged', 'resolved', 'dismissed'),
    defaultValue: 'active',
    comment: '状态'
  },
  acknowledgedBy: {
    type: DataTypes.UUID,
    comment: '确认人ID'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    comment: '确认时间'
  },
  resolvedBy: {
    type: DataTypes.UUID,
    comment: '解决人ID'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    comment: '解决时间'
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    comment: '解决说明'
  },
  assignee: {
    type: DataTypes.UUID,
    comment: '负责人ID'
  },
  assigneeName: {
    type: DataTypes.STRING(100),
    comment: '负责人姓名'
  },
  dueDate: {
    type: DataTypes.DATE,
    comment: '要求处理截止时间'
  },
  relatedLinks: {
    type: DataTypes.JSON,
    comment: '相关链接'
  },
  metadata: {
    type: DataTypes.JSON,
    comment: '扩展数据'
  }
}, {
  tableName: 'restoration_alerts',
  timestamps: true,
  indexes: [
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['alertType'] },
    { fields: ['severity'] },
    { fields: ['status'] },
    { fields: ['assignee'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = RestorationAlert;
