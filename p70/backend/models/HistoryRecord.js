const mongoose = require('mongoose');

const historyRecordSchema = new mongoose.Schema({
  patternId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pattern',
    required: true,
    index: true
  },
  patternName: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'restore', 'export', 'label', 'classify'],
    required: true,
    index: true
  },
  actionDescription: {
    type: String
  },
  snapshot: {
    name: String,
    category: String,
    tags: [String],
    colors: [{
      hex: String,
      name: String,
      percentage: Number
    }],
    outline: mongoose.Schema.Types.Mixed,
    featureVector: [Number],
    imageUrl: String
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  version: {
    type: Number,
    default: 1
  },
  metadata: {
    device: String,
    browser: String,
    ip: String,
    userAgent: String,
    duration: Number
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

historyRecordSchema.index({ patternId: 1, createdAt: -1 });
historyRecordSchema.index({ userId: 1, createdAt: -1 });
historyRecordSchema.index({ action: 1, createdAt: -1 });

historyRecordSchema.statics.createRecord = async function(data) {
  const record = new this(data);
  await record.save();
  return record;
};

historyRecordSchema.statics.getPatternHistory = async function(patternId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    this.find({ patternId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ patternId })
  ]);
  return { records, total, page, limit, pages: Math.ceil(total / limit) };
};

historyRecordSchema.statics.getUserHistory = async function(userId, page = 1, limit = 20, filters = {}) {
  const skip = (page - 1) * limit;
  const query = { userId, ...filters };
  const [records, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  return { records, total, page, limit, pages: Math.ceil(total / limit) };
};

historyRecordSchema.statics.getActivityTimeline = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const timeline = await this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        actions: { $push: '$action' },
        users: { $addToSet: '$userId' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return timeline.map(item => ({
    date: item._id,
    count: item.count,
    uniqueUsers: item.users.length,
    actionBreakdown: item.actions.reduce((acc, action) => {
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {})
  }));
};

historyRecordSchema.statics.getLatestVersion = async function(patternId) {
  const latest = await this.findOne({ patternId })
    .sort({ version: -1 })
    .limit(1);
  return latest ? latest.version : 0;
};

historyRecordSchema.statics.exportHistory = async function(filters = {}) {
  const records = await this.find(filters)
    .sort({ createdAt: -1 })
    .lean();
  
  return records.map(record => ({
    id: record._id,
    patternId: record.patternId,
    patternName: record.patternName,
    user: record.userName,
    action: record.action,
    description: record.actionDescription,
    date: record.createdAt.toISOString(),
    version: record.version
  }));
};

const HistoryRecord = mongoose.model('HistoryRecord', historyRecordSchema);
module.exports = HistoryRecord;
