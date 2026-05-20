const { DataTypes } = require('sequelize');
const { restorationDB } = require('../../config/databases');

const RestorationProgress = restorationDB.define('RestorationProgress', {
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
  stepOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '步骤序号'
  },
  stepName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '步骤名称'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '步骤描述'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'paused', 'cancelled'),
    defaultValue: 'pending',
    comment: '状态'
  },
  startedAt: {
    type: DataTypes.DATE,
    comment: '开始时间'
  },
  completedAt: {
    type: DataTypes.DATE,
    comment: '完成时间'
  },
  restorerId: {
    type: DataTypes.UUID,
    comment: '修复人员ID'
  },
  restorerName: {
    type: DataTypes.STRING(100),
    comment: '修复人员姓名'
  },
  progressPercent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '进度百分比'
  },
  qualityCheck: {
    type: DataTypes.ENUM('pending', 'passed', 'failed', 'rework'),
    defaultValue: 'pending',
    comment: '质量检查'
  },
  qualityCheckNote: {
    type: DataTypes.TEXT,
    comment: '质检备注'
  },
  qualityCheckedBy: {
    type: DataTypes.UUID,
    comment: '质检人ID'
  },
  qualityCheckedAt: {
    type: DataTypes.DATE,
    comment: '质检时间'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  attachments: {
    type: DataTypes.JSON,
    comment: '附件列表'
  },
  traceId: {
    type: DataTypes.STRING(100),
    comment: '追溯ID'
  }
}, {
  tableName: 'restoration_progress',
  timestamps: true,
  indexes: [
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['status'] },
    { fields: ['restorerId'] }
  ]
});

module.exports = RestorationProgress;
