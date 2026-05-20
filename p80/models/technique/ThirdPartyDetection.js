const { DataTypes } = require('sequelize');
const { techniqueDB } = require('../../config/databases');

const ThirdPartyDetection = techniqueDB.define('ThirdPartyDetection', {
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
  detectionId: {
    type: DataTypes.STRING(100),
    unique: true,
    comment: '第三方检测编号'
  },
  organization: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '检测机构名称'
  },
  detectionType: {
    type: DataTypes.ENUM('material_analysis', 'age_dating', 'damage_assessment', 'microscopic_examination', 'full_analysis'),
    comment: '检测类型'
  },
  detectionDate: {
    type: DataTypes.DATE,
    comment: '检测日期'
  },
  reporter: {
    type: DataTypes.STRING(100),
    comment: '报告人'
  },
  reportData: {
    type: DataTypes.JSON,
    comment: '检测报告数据'
  },
  reportFile: {
    type: DataTypes.STRING(500),
    comment: '报告文件URL'
  },
  conclusion: {
    type: DataTypes.TEXT,
    comment: '检测结论'
  },
  recommendations: {
    type: DataTypes.TEXT,
    comment: '修复建议'
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'synced', 'failed', 'partial'),
    defaultValue: 'pending',
    comment: '同步状态'
  },
  syncedAt: {
    type: DataTypes.DATE,
    comment: '同步时间'
  },
  syncError: {
    type: DataTypes.TEXT,
    comment: '同步错误信息'
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已验证'
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
  },
  metadata: {
    type: DataTypes.JSON,
    comment: '第三方原始数据'
  }
}, {
  tableName: 'third_party_detections',
  timestamps: true,
  indexes: [
    { fields: ['bookId'] },
    { fields: ['bookCode'] },
    { fields: ['detectionId'] },
    { fields: ['syncStatus'] }
  ]
});

module.exports = ThirdPartyDetection;
