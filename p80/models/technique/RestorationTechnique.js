const { DataTypes } = require('sequelize');
const { techniqueDB } = require('../../config/databases');

const RestorationTechnique = techniqueDB.define('RestorationTechnique', {
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
    comment: '修复进度ID'
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
  environment: {
    type: DataTypes.JSON,
    comment: '环境参数（温度、湿度等）'
  },
  beforeImages: {
    type: DataTypes.JSON,
    comment: '修复前图片'
  },
  processImages: {
    type: DataTypes.JSON,
    comment: '过程图片'
  },
  afterImages: {
    type: DataTypes.JSON,
    comment: '修复后图片'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '注意事项和备注'
  },
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
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
  traceId: {
    type: DataTypes.STRING(100),
    comment: '追溯ID'
  }
}, {
  tableName: 'restoration_techniques',
  timestamps: true,
  indexes: [
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['techniqueType'] },
    { fields: ['operatorId'] }
  ]
});

module.exports = RestorationTechnique;
