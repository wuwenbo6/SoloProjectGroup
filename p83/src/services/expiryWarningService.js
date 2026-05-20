const Batch = require('../models/batch/Batch');
const nodeSchedule = require('node-schedule');

class ExpiryWarningService {
  constructor() {
    this.scheduledJobs = new Map();
    this.warningHistory = [];
  }

  calculateDaysUntilExpiry(expiryDate) {
    if (!expiryDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  determineWarningLevel(daysUntilExpiry, batch) {
    const warningDays = batch.warningSettings?.warningDays || 30;
    
    if (daysUntilExpiry < 0) {
      return 'expired';
    } else if (daysUntilExpiry <= 7) {
      return 'critical';
    } else if (daysUntilExpiry <= 15) {
      return 'high';
    } else if (daysUntilExpiry <= warningDays) {
      return 'medium';
    } else if (daysUntilExpiry <= warningDays * 2) {
      return 'low';
    }
    return 'normal';
  }

  async checkBatchExpiry(batchId) {
    const batch = await Batch.findOne({ batchId });
    if (!batch || !batch.expiryDate) {
      return null;
    }

    const daysUntilExpiry = this.calculateDaysUntilExpiry(batch.expiryDate);
    const warningLevel = this.determineWarningLevel(daysUntilExpiry, batch);
    
    let expiryStatus = 'normal';
    if (daysUntilExpiry < 0) {
      expiryStatus = 'expired';
    } else if (warningLevel !== 'normal') {
      expiryStatus = 'warning';
    }

    if (batch.expiryStatus !== expiryStatus) {
      batch.expiryStatus = expiryStatus;
      await batch.save();
    }

    return {
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      name: batch.name,
      materialType: batch.materialType,
      expiryDate: batch.expiryDate,
      daysUntilExpiry,
      warningLevel,
      expiryStatus,
      quantity: batch.quantity,
      unit: batch.unit,
      warehouse: batch.warehouse,
      storageLocation: batch.storageLocation
    };
  }

  async scanAllBatchesForExpiry(options = {}) {
    const {
      materialType,
      status,
      warningLevel,
      onlyWarningEnabled = true,
      daysThreshold
    } = options;

    const query = {
      expiryDate: { $exists: true, $ne: null }
    };

    if (materialType) {
      query.materialType = materialType;
    }

    if (status) {
      query.status = status;
    }

    if (onlyWarningEnabled) {
      query['warningSettings.enableExpiryWarning'] = true;
    }

    const batches = await Batch.find(query);
    const results = [];
    const warnings = [];
    const expired = [];

    for (const batch of batches) {
      const checkResult = await this.checkBatchExpiry(batch.batchId);
      if (checkResult) {
        results.push(checkResult);
        
        if (checkResult.warningLevel === 'expired' || checkResult.expiryStatus === 'expired') {
          expired.push(checkResult);
        } else if (checkResult.warningLevel !== 'normal') {
          warnings.push(checkResult);
        }
      }
    }

    let filteredResults = results;
    if (warningLevel) {
      if (warningLevel === 'expired') {
        filteredResults = expired;
      } else if (warningLevel === 'warning') {
        filteredResults = warnings;
      } else {
        filteredResults = results.filter(r => r.warningLevel === warningLevel);
      }
    }

    if (daysThreshold !== undefined) {
      filteredResults = filteredResults.filter(r => 
        r.daysUntilExpiry !== null && r.daysUntilExpiry <= daysThreshold
      );
    }

    return {
      total: results.length,
      warningCount: warnings.length,
      expiredCount: expired.length,
      normalCount: results.length - warnings.length - expired.length,
      batches: filteredResults,
      warnings,
      expired
    };
  }

  async getExpirySummary(options = {}) {
    const scanResult = await this.scanAllBatchesForExpiry(options);
    
    const summary = {
      totalBatches: scanResult.total,
      normal: scanResult.normalCount,
      warning: scanResult.warningCount,
      expired: scanResult.expiredCount,
      byWarningLevel: {
        critical: scanResult.batches.filter(b => b.warningLevel === 'critical').length,
        high: scanResult.batches.filter(b => b.warningLevel === 'high').length,
        medium: scanResult.batches.filter(b => b.warningLevel === 'medium').length,
        low: scanResult.batches.filter(b => b.warningLevel === 'low').length
      },
      byMaterialType: {},
      upcomingExpiry: []
    };

    const typeCounts = {};
    scanResult.batches.forEach(batch => {
      typeCounts[batch.materialType] = (typeCounts[batch.materialType] || 0) + 1;
    });
    summary.byMaterialType = typeCounts;

    summary.upcomingExpiry = scanResult.batches
      .filter(b => b.daysUntilExpiry !== null && b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 30)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
      .slice(0, 10);

    return summary;
  }

  async updateBatchWarningSettings(batchId, settings) {
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (!batch.warningSettings) {
      batch.warningSettings = {};
    }

    if (settings.enableExpiryWarning !== undefined) {
      batch.warningSettings.enableExpiryWarning = settings.enableExpiryWarning;
    }
    if (settings.warningDays !== undefined) {
      batch.warningSettings.warningDays = settings.warningDays;
    }
    if (settings.warningLevel !== undefined) {
      batch.warningSettings.warningLevel = settings.warningLevel;
    }
    if (settings.notifyUsers !== undefined) {
      batch.warningSettings.notifyUsers = settings.notifyUsers;
    }

    await batch.save();
    return batch.warningSettings;
  }

  async sendExpiryNotifications(batchIds = null) {
    let batchesToNotify;
    
    if (batchIds) {
      batchesToNotify = await Batch.find({
        batchId: { $in: batchIds },
        'warningSettings.enableExpiryWarning': true
      });
    } else {
      const scanResult = await this.scanAllBatchesForExpiry();
      batchesToNotify = scanResult.warnings.map(w => w.batchId);
      batchesToNotify = await Batch.find({ batchId: { $in: batchesToNotify } });
    }

    const notifications = [];

    for (const batch of batchesToNotify) {
      const checkResult = await this.checkBatchExpiry(batch.batchId);
      if (checkResult && checkResult.warningLevel !== 'normal') {
        const notification = {
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
          warningLevel: checkResult.warningLevel,
          daysUntilExpiry: checkResult.daysUntilExpiry,
          expiryDate: batch.expiryDate,
          notifyUsers: batch.warningSettings?.notifyUsers || [],
          message: this.generateWarningMessage(checkResult),
          timestamp: new Date()
        };

        notifications.push(notification);

        batch.warningSettings.lastWarningTime = new Date();
        batch.warningSettings.warningCount = (batch.warningSettings.warningCount || 0) + 1;
        await batch.save();

        this.warningHistory.push({
          ...notification,
          sent: true
        });
      }
    }

    return {
      sent: notifications.length,
      notifications
    };
  }

  generateWarningMessage(checkResult) {
    const { batchNumber, name, daysUntilExpiry, warningLevel, expiryDate } = checkResult;
    
    if (warningLevel === 'expired' || daysUntilExpiry < 0) {
      return `【过期预警】批次 ${batchNumber}(${name}) 已过期 ${Math.abs(daysUntilExpiry)} 天，过期日期：${expiryDate.toLocaleDateString()}`;
    }

    const levelMessages = {
      critical: `【紧急预警】批次 ${batchNumber}(${name}) 将在 ${daysUntilExpiry} 天后过期，请立即处理！`,
      high: `【高级预警】批次 ${batchNumber}(${name}) 将在 ${daysUntilExpiry} 天后过期，请尽快处理。`,
      medium: `【过期提醒】批次 ${batchNumber}(${name}) 将在 ${daysUntilExpiry} 天后过期。`,
      low: `【温馨提示】批次 ${batchNumber}(${name}) 将在 ${daysUntilExpiry} 天后过期。`
    };

    return levelMessages[warningLevel] || levelMessages.medium;
  }

  scheduleDailyExpiryCheck(cronTime = '0 9 * * *') {
    if (this.scheduledJobs.has('dailyExpiryCheck')) {
      this.scheduledJobs.get('dailyExpiryCheck').cancel();
    }

    const job = nodeSchedule.scheduleJob(cronTime, async () => {
      console.log('开始执行每日过期预警检查...');
      try {
        const result = await this.scanAllBatchesForExpiry();
        const notificationResult = await this.sendExpiryNotifications();
        
        console.log(`过期预警检查完成：发现 ${result.warningCount} 个预警批次，${result.expiredCount} 个已过期批次`);
        console.log(`已发送 ${notificationResult.sent} 条预警通知`);
      } catch (error) {
        console.error('每日过期预警检查失败:', error);
      }
    });

    this.scheduledJobs.set('dailyExpiryCheck', job);
    console.log('每日过期预警检查任务已调度');
  }

  getWarningHistory(batchId = null, limit = 100) {
    let history = [...this.warningHistory];
    
    if (batchId) {
      history = history.filter(h => h.batchId === batchId);
    }
    
    return history
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getBatchExpiryCalendar(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const batches = await Batch.find({
      expiryDate: {
        $gte: startDate,
        $lte: endDate
      }
    });

    const calendar = {};
    
    for (const batch of batches) {
      const day = new Date(batch.expiryDate).getDate();
      const checkResult = await this.checkBatchExpiry(batch.batchId);
      
      if (!calendar[day]) {
        calendar[day] = [];
      }
      
      calendar[day].push({
        batchId: batch.batchId,
        batchNumber: batch.batchNumber,
        name: batch.name,
        expiryDate: batch.expiryDate,
        warningLevel: checkResult?.warningLevel || 'normal'
      });
    }

    return calendar;
  }
}

module.exports = new ExpiryWarningService();
