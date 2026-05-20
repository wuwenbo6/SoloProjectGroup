const { DataTypes } = require('sequelize');
const { techniqueDB } = require('../../config/databases');

const TechniqueVersion = techniqueDB.define('TechniqueVersion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  techniqueId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '关联的工艺ID'
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
  versionNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '版本号'
  },
  versionType: {
    type: DataTypes.ENUM('major', 'minor', 'patch', 'revision'),
    defaultValue: 'minor',
    comment: '版本类型'
  },
  techniqueName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '工艺名称'
  },
  techniqueType: {
    type: DataTypes.ENUM('cleaning', 'repair', 'reinforcement', 'mounting', 'sealing', 'other'),
    comment: '工艺类型'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '工艺详细描述'
  },
  materials: {
    type: DataTypes.JSON,
    comment: '使用材料列表'
  },
  tools: {
    type: DataTypes.JSON,
    comment: '使用工具列表'
  },
  steps: {
    type: DataTypes.TEXT,
    comment: '操作步骤'
  },
  environment: {
    type: DataTypes.JSON,
    comment: '环境参数'
  },
  operatorId: {
    type: DataTypes.UUID,
    comment: '操作人员ID'
  },
  operatorName: {
    type: DataTypes.STRING(100),
    comment: '操作人员姓名'
  },
  operatedAt: {
    type: DataTypes.DATE,
    comment: '操作时间'
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: '耗时(分钟)'
  },
  changeLog: {
    type: DataTypes.TEXT,
    comment: '变更日志'
  },
  changeReason: {
    type: DataTypes.STRING(500),
    comment: '变更原因'
  },
  createdBy: {
    type: DataTypes.UUID,
    comment: '创建人ID'
  },
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected', 'obsolete'),
    defaultValue: 'pending',
    comment: '验证状态'
  },
  verifiedBy: {
    type: DataTypes.UUID,
    comment: '验证人ID'
  },
  verifiedAt: {
    type: DataTypes.DATE,
    comment: '验证时间'
  },
  verificationNotes: {
    type: DataTypes.TEXT,
    comment: '验证备注'
  },
  isCurrentVersion: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否当前版本'
  },
  isBaseline: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否基线版本'
  },
  parentVersionId: {
    type: DataTypes.UUID,
    comment: '父版本ID'
  },
  tags: {
    type: DataTypes.JSON,
    comment: '标签列表'
  },
  metadata: {
    type: DataTypes.JSON,
    comment: '扩展数据'
  }
}, {
  tableName: 'technique_versions',
  timestamps: true,
  indexes: [
    { fields: ['techniqueId'] },
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['versionNumber'] },
    { fields: ['isCurrentVersion'] },
    { fields: ['isBaseline'] },
    { fields: ['techniqueType'] },
    { fields: ['operatorId'] }
  ]
});

module.exports = TechniqueVersion;
