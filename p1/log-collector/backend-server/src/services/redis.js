const redis = require('redis');
const { promisify } = require('util');

class RedisService {
  constructor(options = {}) {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      ...options
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.lpush = promisify(this.client.lpush).bind(this.client);
    this.rpush = promisify(this.client.rpush).bind(this.client);
    this.lrange = promisify(this.client.lrange).bind(this.client);
    this.ltrim = promisify(this.client.ltrim).bind(this.client);
    this.llen = promisify(this.client.llen).bind(this.client);
    this.del = promisify(this.client.del).bind(this.client);
    this.incr = promisify(this.client.incr).bind(this.client);
    this.get = promisify(this.client.get).bind(this.client);
    this.setex = promisify(this.client.setex).bind(this.client);
    this.rpoplpush = promisify(this.client.rpoplpush).bind(this.client);
    this.lrem = promisify(this.client.lrem).bind(this.client);
  }

  async pushLogs(logs) {
    const key = 'logs:pending';
    const values = logs.map(log => JSON.stringify(log));
    return this.lpush(key, ...values);
  }

  async getPendingLogs(count = 100) {
    const pendingKey = 'logs:pending';
    const processingKey = 'logs:processing';
    const logs = [];
    
    for (let i = 0; i < count; i++) {
      const log = await this.rpoplpush(pendingKey, processingKey);
      if (!log) break;
      logs.push(JSON.parse(log));
    }
    
    return logs;
  }

  async removeProcessedLogs(count) {
    const key = 'logs:processing';
    return this.ltrim(key, count, -1);
  }

  async removeSpecificLogs(logs) {
    const key = 'logs:processing';
    const pipeline = this.client.multi();
    logs.forEach(log => {
      pipeline.lrem(key, 1, JSON.stringify(log));
    });
    return promisify(pipeline.exec).bind(pipeline)();
  }

  async moveFailedLogsBack() {
    const pendingKey = 'logs:pending';
    const processingKey = 'logs:processing';
    const count = await this.llen(processingKey);
    
    if (count === 0) return 0;
    
    for (let i = 0; i < count; i++) {
      await this.rpoplpush(processingKey, pendingKey);
    }
    
    return count;
  }

  async getPendingLogsCount() {
    const pendingKey = 'logs:pending';
    const processingKey = 'logs:processing';
    const [pendingCount, processingCount] = await Promise.all([
      this.llen(pendingKey),
      this.llen(processingKey)
    ]);
    return pendingCount + processingCount;
  }

  async checkRateLimit(ip, limit, window) {
    const key = `rate:${ip}`;
    const current = await this.get(key);
    
    if (!current) {
      await this.setex(key, window, 1);
      return true;
    }
    
    if (parseInt(current) >= limit) {
      return false;
    }
    
    await this.incr(key);
    return true;
  }

  close() {
    this.client.quit();
  }
}

module.exports = RedisService;
