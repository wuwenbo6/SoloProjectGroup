import redis from '../db/redis.js';
import pool from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';
import { writePoint } from '../db/influxdb.js';

const DEFAULT_RULES = {
  edit_rate: {
    enabled: true,
    threshold: 100,
    windowSeconds: 60,
    description: 'Maximum edits per minute per user',
    severity: 'warning',
  },
  connection_rate: {
    enabled: true,
    threshold: 50,
    windowSeconds: 60,
    description: 'Maximum connections per minute per IP',
    severity: 'warning',
  },
  cursor_movement_rate: {
    enabled: true,
    threshold: 500,
    windowSeconds: 60,
    description: 'Maximum cursor movements per minute',
    severity: 'info',
  },
  large_document_change: {
    enabled: true,
    threshold: 10000,
    windowSeconds: 1,
    description: 'Maximum characters changed in single operation',
    severity: 'critical',
  },
  concurrent_connections: {
    enabled: true,
    threshold: 10,
    windowSeconds: 0,
    description: 'Maximum concurrent connections per user',
    severity: 'warning',
  },
};

const RULES_KEY = 'anomaly_detection_rules';
const METRICS_KEY_PREFIX = 'anomaly_metrics';

class AnomalyDetectionService {
  constructor() {
    this.rules = new Map();
    this.detections = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const savedRules = await redis.hGetAll(RULES_KEY);
    
    if (Object.keys(savedRules).length === 0) {
      for (const [name, rule] of Object.entries(DEFAULT_RULES)) {
        await this.setRule(name, rule);
      }
    } else {
      for (const [name, ruleJson] of Object.entries(savedRules)) {
        this.rules.set(name, JSON.parse(ruleJson));
      }
    }

    await this.initDatabase();
    this.initialized = true;
    console.log('Anomaly detection service initialized');
  }

  async initDatabase() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS anomaly_detections (
        id UUID PRIMARY KEY,
        rule_name VARCHAR(100) NOT NULL,
        device_id VARCHAR(255),
        user_id UUID,
        document_id UUID,
        severity VARCHAR(20) NOT NULL,
        metric_value FLOAT NOT NULL,
        threshold FLOAT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS anomaly_rules (
        id UUID PRIMARY KEY,
        rule_name VARCHAR(100) UNIQUE NOT NULL,
        device_id VARCHAR(255),
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_anomaly_detections_created_at ON anomaly_detections(created_at);
      CREATE INDEX IF NOT EXISTS idx_anomaly_detections_device_id ON anomaly_detections(device_id);
    `);
  }

  async getRule(ruleName, deviceId = 'default') {
    const key = `${ruleName}:${deviceId}`;
    const cached = await redis.hGet(RULES_KEY, key);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await pool.query(
      'SELECT config FROM anomaly_rules WHERE rule_name = $1 AND (device_id = $2 OR device_id IS NULL)',
      [ruleName, deviceId]
    );

    if (result.rows.length > 0) {
      const config = result.rows[0].config;
      await redis.hSet(RULES_KEY, key, JSON.stringify(config));
      return config;
    }

    return DEFAULT_RULES[ruleName] || null;
  }

  async setRule(ruleName, config, deviceId = null) {
    const id = uuidv4();
    const key = `${ruleName}:${deviceId || 'default'}`;

    await pool.query(`
      INSERT INTO anomaly_rules (id, rule_name, device_id, config, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (rule_name, COALESCE(device_id, 'default')) 
      DO UPDATE SET config = $4, updated_at = NOW()
    `, [id, ruleName, deviceId, JSON.stringify(config)]);

    await redis.hSet(RULES_KEY, key, JSON.stringify(config));
    this.rules.set(key, config);

    return { ruleName, deviceId, config };
  }

  async deleteRule(ruleName, deviceId = null) {
    const key = `${ruleName}:${deviceId || 'default'}`;

    await pool.query(
      'DELETE FROM anomaly_rules WHERE rule_name = $1 AND COALESCE(device_id, \'default\') = $2',
      [ruleName, deviceId || 'default']
    );

    await redis.hDel(RULES_KEY, key);
    this.rules.delete(key);

    return true;
  }

  async getAllRules(deviceId = null) {
    const query = deviceId
      ? 'SELECT rule_name, device_id, config FROM anomaly_rules WHERE device_id = $1 OR device_id IS NULL'
      : 'SELECT rule_name, device_id, config FROM anomaly_rules';
    
    const params = deviceId ? [deviceId] : [];
    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      ruleName: row.rule_name,
      deviceId: row.device_id,
      config: row.config,
    }));
  }

  async checkMetric(ruleName, value, deviceId = 'default', context = {}) {
    const rule = await this.getRule(ruleName, deviceId);
    if (!rule || !rule.enabled) return null;

    const isAnomaly = value > rule.threshold;

    if (isAnomaly) {
      const detection = {
        id: uuidv4(),
        ruleName,
        deviceId,
        userId: context.userId || null,
        documentId: context.documentId || null,
        severity: rule.severity,
        metricValue: value,
        threshold: rule.threshold,
        details: context,
        createdAt: new Date(),
      };

      await pool.query(`
        INSERT INTO anomaly_detections 
        (id, rule_name, device_id, user_id, document_id, severity, metric_value, threshold, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        detection.id,
        detection.ruleName,
        detection.deviceId,
        detection.userId,
        detection.documentId,
        detection.severity,
        detection.metricValue,
        detection.threshold,
        JSON.stringify(detection.details),
      ]);

      writePoint('anomalies', {
        count: 1,
        value,
        threshold: rule.threshold,
      }, {
        rule_name: ruleName,
        device_id: deviceId,
        severity: rule.severity,
      });

      console.warn(`Anomaly detected: ${ruleName} - value: ${value}, threshold: ${rule.threshold}`);
      return detection;
    }

    return null;
  }

  async recordMetric(metricName, value, deviceId = 'default') {
    const key = `${METRICS_KEY_PREFIX}:${metricName}:${deviceId}`;
    const now = Date.now();
    const windowStart = now - 60000;

    await redis.zAdd(key, { score: now, value: `${now}:${value}` });
    await redis.zRemRangeByScore(key, 0, windowStart);
    await redis.expire(key, 300);
  }

  async getMetricValue(metricName, deviceId = 'default', windowSeconds = 60) {
    const key = `${METRICS_KEY_PREFIX}:${metricName}:${deviceId}`;
    const windowStart = Date.now() - (windowSeconds * 1000);

    const values = await redis.zRangeByScore(key, windowStart, Date.now());
    let sum = 0;
    values.forEach(v => {
      const [, val] = v.split(':');
      sum += parseFloat(val);
    });

    return sum;
  }

  async getDetections(options = {}) {
    const { ruleName, deviceId, severity, startTime, endTime, limit = 100, offset = 0 } = options;

    let query = 'SELECT * FROM anomaly_detections WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (ruleName) {
      query += ` AND rule_name = $${paramIndex++}`;
      params.push(ruleName);
    }

    if (deviceId) {
      query += ` AND device_id = $${paramIndex++}`;
      params.push(deviceId);
    }

    if (severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (startTime) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startTime);
    }

    if (endTime) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endTime);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getDetectionStats(timeRange = '1h') {
    const timeMap = {
      '1h': "NOW() - INTERVAL '1 hour'",
      '24h': "NOW() - INTERVAL '24 hours'",
      '7d': "NOW() - INTERVAL '7 days'",
      '30d': "NOW() - INTERVAL '30 days'",
    };

    const timeClause = timeMap[timeRange] || timeMap['24h'];

    const result = await pool.query(`
      SELECT 
        rule_name,
        severity,
        COUNT(*) as count,
        AVG(metric_value) as avg_value
      FROM anomaly_detections
      WHERE created_at >= ${timeClause}
      GROUP BY rule_name, severity
      ORDER BY count DESC
    `);

    return result.rows;
  }
}

const anomalyService = new AnomalyDetectionService();

export default anomalyService;
export { DEFAULT_RULES };
