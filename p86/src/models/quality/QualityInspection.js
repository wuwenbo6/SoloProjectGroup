const mongoose = require('mongoose');
const { connections } = require('../../config/databases');

const qualityInspectionSchema = new mongoose.Schema({
  inspectionCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  batchCode: {
    type: String,
    required: true,
  },
  productionRecordId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  craftId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  craftCode: {
    type: String,
    required: true,
  },
  inspectionType: {
    type: String,
    required: true,
    enum: ['过程检验', '成品检验', '抽样检验', '第三方检验'],
  },
  inspectorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  inspectorName: {
    type: String,
    required: true,
  },
  inspectionTime: {
    type: Date,
    required: true,
  },
  items: [{
    itemName: {
      type: String,
      required: true,
    },
    standard: {
      type: String,
      required: true,
    },
    measuredValue: {
      type: String,
    },
    result: {
      type: String,
      required: true,
      enum: ['合格', '不合格', '待检'],
    },
    remarks: {
      type: String,
    },
  }],
  overallResult: {
    type: String,
    required: true,
    enum: ['合格', '不合格', '待判定', '有条件合格'],
  },
  defects: [{
    defectType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['轻微', '一般', '严重', '致命'],
    },
    location: {
      type: String,
    },
  }],
  correctiveActions: [{
    action: {
      type: String,
      required: true,
    },
    responsiblePerson: {
      type: String,
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['待执行', '执行中', '已完成', '已验证'],
      default: '待执行',
    },
  }],
  images: [{
    url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
  }],
  thirdPartyInfo: {
    organizationName: {
      type: String,
    },
    reportNumber: {
      type: String,
    },
    reportDate: {
      type: Date,
    },
    synced: {
      type: Boolean,
      default: false,
    },
    syncTime: {
      type: Date,
    },
  },
  remarks: {
    type: String,
  },
  status: {
    type: String,
    enum: ['草稿', '已提交', '已审核', '已归档'],
    default: '草稿',
  },
}, {
  timestamps: true,
});

qualityInspectionSchema.index({ batchId: 1, createdAt: -1 });
qualityInspectionSchema.index({ overallResult: 1 });

module.exports = connections.quality.model('QualityInspection', qualityInspectionSchema);