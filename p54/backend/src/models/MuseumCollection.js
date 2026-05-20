const { DataTypes, Op } = require('sequelize')
const sequelize = require('./index')

const MuseumCollection = sequelize.define('MuseumCollection', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  museumCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '博物馆编号'
  },
  museumName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '博物馆名称'
  },
  collectionNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '馆藏编号'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '拓片名称'
  },
  originalTitle: {
    type: DataTypes.STRING(200),
    comment: '原碑名称'
  },
  dynasty: {
    type: DataTypes.STRING(50),
    comment: '朝代'
  },
  era: {
    type: DataTypes.STRING(50),
    comment: '年代/年号'
  },
  scriptType: {
    type: DataTypes.STRING(50),
    comment: '字体类型：篆、隶、楷、行、草'
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '分类：碑、墓志、造像、金文、陶文、玺印、砖瓦'
  },
  material: {
    type: DataTypes.STRING(50),
    comment: '材质：石、铜、玉、陶'
  },
  author: {
    type: DataTypes.STRING(100),
    comment: '书者/刻者'
  },
  location: {
    type: DataTypes.STRING(200),
    comment: '出土地点/收藏地点'
  },
  rubbingsDate: {
    type: DataTypes.STRING(50),
    comment: '拓制年代'
  },
  rubbingsType: {
    type: DataTypes.STRING(50),
    comment: '拓片类型：原拓、翻拓、影印'
  },
  size: {
    type: DataTypes.STRING(100),
    comment: '尺寸'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '描述信息'
  },
  contentPreview: {
    type: DataTypes.TEXT,
    comment: '内容预览/释文预览'
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    comment: '图片URL'
  },
  referenceUrl: {
    type: DataTypes.STRING(500),
    comment: '参考链接'
  },
  charactersCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '文字数量'
  },
  preservation: {
    type: DataTypes.STRING(20),
    comment: '保存状况：完好、残损、破碎'
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否发布'
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'synced', 'failed'),
    defaultValue: 'pending',
    comment: '同步状态'
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    comment: '最后同步时间'
  },
  source: {
    type: DataTypes.STRING(50),
    defaultValue: 'museum',
    comment: '数据来源'
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '标签数组'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '扩展元数据'
  },
  annotationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '释读数量统计'
  }
}, {
  tableName: 'museum_collections',
  comment: '金石博物馆馆藏数据表',
  indexes: [
    {
      name: 'idx_museum_code',
      fields: ['museumCode']
    },
    {
      name: 'idx_collection_no',
      fields: ['collectionNo']
    },
    {
      name: 'idx_dynasty',
      fields: ['dynasty']
    },
    {
      name: 'idx_script_type',
      fields: ['scriptType']
    },
    {
      name: 'idx_category',
      fields: ['category']
    },
    {
      name: 'idx_title_search',
      type: 'FULLTEXT',
      fields: ['title', 'description', 'contentPreview']
    }
  ]
})

module.exports = MuseumCollection
