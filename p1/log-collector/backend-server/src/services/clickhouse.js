const { ClickHouse } = require('clickhouse');

class ClickHouseService {
  constructor(options = {}) {
    this.clickhouse = new ClickHouse({
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: process.env.CLICKHOUSE_PORT || 8123,
      user: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DB || 'logs',
      ...options
    });
  }

  async init() {
    await this.createDatabase();
    await this.createTable();
  }

  async createDatabase() {
    const sql = `
      CREATE DATABASE IF NOT EXISTS logs
    `;
    return this.clickhouse.query(sql).toPromise();
  }

  async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS logs.logs (
        app_id String,
        user_id String,
        level String,
        message String,
        timestamp Int64,
        extra String DEFAULT '',
        url String DEFAULT '',
        user_agent String DEFAULT '',
        day Date DEFAULT toDate(toDateTime(timestamp / 1000))
      ) ENGINE = MergeTree()
      PARTITION BY (app_id, day)
      ORDER BY (app_id, timestamp, level)
      TTL day + INTERVAL 30 DAY
    `;
    return this.clickhouse.query(sql).toPromise();
  }

  async insertLogs(logs) {
    const data = logs.map(log => ({
      app_id: log.app_id || '',
      user_id: log.user_id || '',
      level: log.level || 'INFO',
      message: log.message || '',
      timestamp: log.timestamp || Date.now(),
      extra: typeof log.extra === 'string' ? log.extra : JSON.stringify(log.extra || {}),
      url: log.url || '',
      user_agent: log.user_agent || ''
    }));

    return this.clickhouse.insert('logs.logs', data).toPromise();
  }

  async queryLogs(options = {}) {
    const {
      appId,
      userId,
      level,
      startTime,
      endTime,
      page = 1,
      pageSize = 20
    } = options;

    let where = [];
    if (appId) {
      where.push(`app_id = '${appId}'`);
    }
    if (userId) {
      where.push(`user_id = '${userId}'`);
    }
    if (level) {
      where.push(`level = '${level}'`);
    }
    if (startTime) {
      where.push(`timestamp >= ${startTime}`);
    }
    if (endTime) {
      where.push(`timestamp <= ${endTime}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        app_id,
        user_id,
        level,
        message,
        timestamp,
        extra,
        url,
        user_agent,
        day
      FROM logs.logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT count(*) as total
      FROM logs.logs
      ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.clickhouse.query(sql).toPromise(),
      this.clickhouse.query(countSql).toPromise()
    ]);

    const logs = rows.map(row => ({
      ...row,
      extra: this.safeParse(row.extra)
    }));

    return {
      logs,
      total: countResult[0]?.total || 0,
      page,
      pageSize
    };
  }

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  async getErrorTypeStats(options = {}) {
    const { appId, startTime, endTime } = options;
    
    let whereConditions = ["level IN ('ERROR', 'FATAL')"];
    
    if (appId) {
      whereConditions.push(`app_id = '${appId}'`);
    }
    if (startTime) {
      whereConditions.push(`timestamp >= ${startTime}`);
    }
    if (endTime) {
      whereConditions.push(`timestamp <= ${endTime}`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    const sql = `
      SELECT 
        app_id,
        JSONExtractString(extra, 'type') AS error_type,
        count() AS error_count
      FROM logs.logs
      ${whereClause}
      GROUP BY app_id, error_type
      ORDER BY app_id, error_count DESC
    `;
    
    const rows = await this.clickhouse.query(sql).toPromise();
    
    const result = {};
    rows.forEach(row => {
      if (!result[row.app_id]) {
        result[row.app_id] = [];
      }
      result[row.app_id].push({
        type: row.error_type || 'unknown',
        count: row.error_count
      });
    });
    
    return result;
  }

  async getErrorRateTrend(options = {}) {
    const { appId, startTime, endTime, interval = 'hour' } = options;
    
    const now = Date.now();
    const defaultStartTime = now - 7 * 24 * 60 * 60 * 1000;
    
    const actualStartTime = startTime || defaultStartTime;
    const actualEndTime = endTime || now;
    
    let timeGroupExpr;
    switch (interval) {
      case 'minute':
        timeGroupExpr = 'toStartOfMinute(toDateTime(timestamp / 1000))';
        break;
      case 'hour':
        timeGroupExpr = 'toStartOfHour(toDateTime(timestamp / 1000))';
        break;
      case 'day':
        timeGroupExpr = 'toDate(toDateTime(timestamp / 1000))';
        break;
      default:
        timeGroupExpr = 'toStartOfHour(toDateTime(timestamp / 1000))';
    }
    
    let whereConditions = [
      `timestamp >= ${actualStartTime}`,
      `timestamp <= ${actualEndTime}`
    ];
    
    if (appId) {
      whereConditions.push(`app_id = '${appId}'`);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const sql = `
      SELECT 
        ${timeGroupExpr} AS time_bucket,
        count() AS total_logs,
        sumIf(1, level IN ('ERROR', 'FATAL')) AS error_logs,
        round(error_logs * 100.0 / if(total_logs = 0, 1, total_logs), 2) AS error_rate
      FROM logs.logs
      WHERE ${whereClause}
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;
    
    const rows = await this.clickhouse.query(sql).toPromise();
    
    return rows.map(row => ({
      time: row.time_bucket,
      total_logs: row.total_logs,
      error_logs: row.error_logs,
      error_rate: parseFloat(row.error_rate)
    }));
  }

  async getLogLevelDistribution(options = {}) {
    const { appId, startTime, endTime } = options;
    
    let whereConditions = [];
    
    if (appId) {
      whereConditions.push(`app_id = '${appId}'`);
    }
    if (startTime) {
      whereConditions.push(`timestamp >= ${startTime}`);
    }
    if (endTime) {
      whereConditions.push(`timestamp <= ${endTime}`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    const sql = `
      SELECT 
        level,
        count() AS count
      FROM logs.logs
      ${whereClause}
      GROUP BY level
      ORDER BY count DESC
    `;
    
    const rows = await this.clickhouse.query(sql).toPromise();
    
    const result = {};
    rows.forEach(row => {
      result[row.level] = row.count;
    });
    
    return result;
  }

  async getUserErrorStats(options = {}) {
    const { appId, startTime, endTime, limit = 100 } = options;
    
    let whereConditions = ["level IN ('ERROR', 'FATAL')"];
    
    if (appId) {
      whereConditions.push(`app_id = '${appId}'`);
    }
    if (startTime) {
      whereConditions.push(`timestamp >= ${startTime}`);
    }
    if (endTime) {
      whereConditions.push(`timestamp <= ${endTime}`);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const sql = `
      SELECT 
        user_id,
        count() AS error_count
      FROM logs.logs
      WHERE ${whereClause}
      GROUP BY user_id
      ORDER BY error_count DESC
      LIMIT ${limit}
    `;
    
    const rows = await this.clickhouse.query(sql).toPromise();
    
    return rows.map(row => ({
      user_id: row.user_id,
      error_count: row.error_count
    }));
  }
}

module.exports = ClickHouseService;
