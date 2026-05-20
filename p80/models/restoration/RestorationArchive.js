const { DataTypes } = require('sequelize');
const { restorationDB } = require('../../config/databases');

const RestorationArchive = restorationDB.define('RestorationArchive', {
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
  archiveNumber: {
    type: DataTypes.STRING(100),
    unique: true,
    comment: '档案编号'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '档案标题'
  },
  archiveType: {
    type: DataTypes.ENUM('restoration_report', 'photo_record', 'technique_record', 'inspection_report', 'full_archive'),
    comment: '档案类型'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '档案描述'
  },
  startDate: {
    type: DataTypes.DATE,
    comment: '修复开始日期'
  },
  endDate: {
    type: DataTypes.DATE,
    comment: '修复完成日期'
  },
  chiefRestorer: {
    type: DataTypes.STRING(100),
    comment: '主修人员'
  },
  restorerList: {
    type: DataTypes.JSON,
    comment: '参与人员列表'
  },
  totalDuration: {
    type: DataTypes.INTEGER,
    comment: '总工时(小时)'
  },
  materialsUsed: {
    type: DataTypes.JSON,
    comment: '使用材料汇总'
  },
  techniquesApplied: {
    type: DataTypes.JSON,
    comment: '应用工艺列表'
  },
  damageBefore: {
    type: DataTypes.TEXT,
    comment: '修复前破损情况'
  },
  resultAfter: {
    type: DataTypes.TEXT,
    comment: '修复后效果'
  },
  qualityAssessment: {
    type: DataTypes.ENUM('excellent', 'good', 'qualified', 'needs_review'),
    comment: '质量评定'
  },
  files: {
    type: DataTypes.JSON,
    comment: '档案文件列表'
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'archived', 'rejected'),
    defaultValue: 'draft',
    comment: '档案状态'
  },
  reviewedBy: {
    type: DataTypes.UUID,
    comment: '审核人ID'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    comment: '审核时间'
  },
  reviewNotes: {
    type: DataTypes.TEXT,
    comment: '审核意见'
  },
  archivedBy: {
    type: DataTypes.UUID,
    comment: '归档人ID'
  },
  archivedAt: {
    type: DataTypes.DATE,
    comment: '归档时间'
  },
  location: {
    type: DataTypes.STRING(200),
    comment: '档案存放位置'
  },
  traceId: {
    type: DataTypes.STRING(100),
    comment: '追溯ID'
  },
  isDigital: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否数字化档案'
  },
  accessLevel: {
    type: DataTypes.ENUM('public', 'internal', 'confidential'),
    defaultValue: 'internal',
    comment: '访问级别'
  }
}, {
  tableName: 'restoration_archives',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['archiveNumber'] },
    { fields: ['status'] }
  ]
});

module.exports = RestorationArchive;
