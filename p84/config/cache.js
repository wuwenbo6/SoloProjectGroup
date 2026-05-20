const logger = require('./logger');

class CacheManager {
  constructor(ttl = 300000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  generateKey(prefix, ...args) {
    return `${prefix}:${args.join(':')}`;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.value;
  }

  set(key, value, customTtl) {
    const expiry = Date.now() + (customTtl || this.ttl);
    this.cache.set(key, { value, expiry });
    this.stats.sets++;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clearPrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size
    };
  }

  async wrap(key, fn, customTtl) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, customTtl);
    return value;
  }
}

const processTemplateCache = new CacheManager(300000);
const productionRecordCache = new CacheManager(60000);
const qualityCache = new CacheManager(30000);
const batchCache = new CacheManager(60000);

const invalidateProcessTemplateCache = (templateId) => {
  processTemplateCache.delete(`template:${templateId}`);
  processTemplateCache.clearPrefix('templates:');
  logger.info(`工艺模板缓存已失效: ${templateId}`);
};

const invalidateProductionRecordCache = (recordId) => {
  productionRecordCache.delete(`record:${recordId}`);
  productionRecordCache.clearPrefix('records:');
  logger.info(`生产记录缓存已失效: ${recordId}`);
};

const invalidateBatchCache = (batchId) => {
  batchCache.delete(`batch:${batchId}`);
  batchCache.clearPrefix('batches:');
  logger.info(`批次缓存已失效: ${batchId}`);
};

const invalidateQualityCache = (inspectionId) => {
  qualityCache.delete(`inspection:${inspectionId}`);
  qualityCache.clearPrefix('inspections:');
  logger.info(`品质检测缓存已失效: ${inspectionId}`);
};

const getCacheStats = () => ({
  processTemplate: processTemplateCache.getStats(),
  productionRecord: productionRecordCache.getStats(),
  quality: qualityCache.getStats(),
  batch: batchCache.getStats()
});

module.exports = {
  processTemplateCache,
  productionRecordCache,
  qualityCache,
  batchCache,
  invalidateProcessTemplateCache,
  invalidateProductionRecordCache,
  invalidateBatchCache,
  invalidateQualityCache,
  getCacheStats
};
