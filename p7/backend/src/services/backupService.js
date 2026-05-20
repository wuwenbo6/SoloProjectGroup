import { v4 as uuidv4 } from 'uuid';
import pool from '../db/postgres.js';
import redis from '../db/redis.js';
import { queryApi, influxDB } from '../db/influxdb.js';
import batchWriter from './batchWriter.js';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, '../../backups');

const S3_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
  forcePathStyle: true,
};

const s3Client = new S3Client(S3_CONFIG);
const BUCKET_NAME = process.env.S3_BUCKET || 'latex-collab-backups';

class BackupService {
  constructor() {
    this.backupInProgress = false;
    this.activeBackups = new Map();
    this.initStorage();
  }

  initStorage() {
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  async createBackup(options = {}) {
    const {
      includePostgres = true,
      includeRedis = true,
      includeInfluxDB = false,
      compress = true,
      uploadToS3 = true,
      retentionDays = 30,
    } = options;

    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const backupId = uuidv4();
    const startTime = Date.now();

    try {
      const backupData = {
        id: backupId,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        data: {},
      };

      if (includePostgres) {
        backupData.data.postgres = await this.backupPostgres();
      }

      if (includeRedis) {
        backupData.data.redis = await this.backupRedis();
      }

      if (includeInfluxDB) {
        backupData.data.influxdb = await this.backupInfluxDB();
      }

      const filename = `backup_${backupId}_${Date.now()}.json${compress ? '.gz' : ''}`;
      const filePath = join(BACKUP_DIR, filename);

      await this.saveBackupToFile(backupData, filePath, compress);

      if (uploadToS3) {
        await this.uploadToS3(filePath, filename);
      }

      const duration = Date.now() - startTime;
      const backupRecord = {
        id: backupId,
        filename,
        size: Buffer.byteLength(JSON.stringify(backupData)),
        duration,
        includePostgres,
        includeRedis,
        includeInfluxDB,
        createdAt: backupData.createdAt,
        retentionUntil: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
      };

      await this.saveBackupRecord(backupRecord);

      this.activeBackups.set(backupId, backupRecord);
      this.backupInProgress = false;

      return backupRecord;
    } catch (err) {
      this.backupInProgress = false;
      throw err;
    }
  }

  async backupPostgres() {
    const tables = ['documents', 'snapshots', 'operations', 'audit_logs', 'anomaly_detections', 'anomaly_rules'];
    const data = {};

    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        data[table] = result.rows;
      } catch (err) {
        console.warn(`Failed to backup table ${table}:`, err.message);
        data[table] = [];
      }
    }

    return data;
  }

  async backupRedis() {
    const keys = await redis.keys('*');
    const data = {};

    for (const key of keys) {
      const type = await redis.type(key);
      
      switch (type) {
        case 'string':
          data[key] = { type, value: await redis.get(key) };
          break;
        case 'hash':
          data[key] = { type, value: await redis.hGetAll(key) };
          break;
        case 'set':
          data[key] = { type, value: await redis.sMembers(key) };
          break;
        case 'zset':
          const zValues = await redis.zRangeWithScores(key, 0, -1);
          data[key] = { type, value: zValues };
          break;
        case 'list':
          data[key] = { type, value: await redis.lRange(key, 0, -1) };
          break;
      }
    }

    return data;
  }

  async backupInfluxDB() {
    const measurements = ['user_actions', 'document_changes', 'anomalies', 'connection_events'];
    const data = {};

    for (const measurement of measurements) {
      const fluxQuery = `
        from(bucket: "${process.env.INFLUXDB_BUCKET || 'latex-collab'}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> limit(n: 10000)
      `;

      try {
        const rows = await queryApi.collectRows(fluxQuery);
        data[measurement] = rows;
      } catch (err) {
        console.warn(`Failed to backup InfluxDB measurement ${measurement}:`, err.message);
        data[measurement] = [];
      }
    }

    return data;
  }

  async saveBackupToFile(backupData, filePath, compress) {
    return new Promise((resolve, reject) => {
      const jsonStr = JSON.stringify(backupData, null, 2);
      const stream = createWriteStream(filePath);
      
      if (compress) {
        const gzip = createGzip();
        stream.write(gzip.write(jsonStr), (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        stream.write(jsonStr, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  async uploadToS3(filePath, filename) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: Buffer.from(filePath),
      });
      await s3Client.send(command);
      console.log(`Backup uploaded to S3: ${filename}`);
    } catch (err) {
      console.error('Failed to upload to S3:', err);
      throw err;
    }
  }

  async saveBackupRecord(record) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backups (
        id UUID PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        duration INTEGER NOT NULL,
        include_postgres BOOLEAN DEFAULT TRUE,
        include_redis BOOLEAN DEFAULT TRUE,
        include_influxdb BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        retention_until TIMESTAMP
      )
    `);

    await pool.query(`
      INSERT INTO backups (id, filename, size, duration, include_postgres, include_redis, include_influxdb, created_at, retention_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      record.id,
      record.filename,
      record.size,
      record.duration,
      record.includePostgres,
      record.includeRedis,
      record.includeInfluxDB,
      new Date(record.createdAt),
      new Date(record.retentionUntil),
    ]);
  }

  async restoreBackup(backupId, options = {}) {
    const {
      restorePostgres = true,
      restoreRedis = true,
      restoreInfluxDB = false,
      dryRun = false,
    } = options;

    const backup = await this.getBackupRecord(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const backupData = await this.loadBackupFromFile(backup.filename);

    if (!dryRun) {
      if (restorePostgres && backupData.data.postgres) {
        await this.restorePostgres(backupData.data.postgres);
      }

      if (restoreRedis && backupData.data.redis) {
        await this.restoreRedis(backupData.data.redis);
      }
    }

    return {
      success: true,
      restored: {
        postgres: restorePostgres,
        redis: restoreRedis,
        influxdb: restoreInfluxDB,
      },
      dryRun,
      backup: backupData,
    };
  }

  async restorePostgres(data) {
    for (const [table, rows] of Object.entries(data)) {
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = rows.map((_, i) => 
        `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
      ).join(', ');

      const values = rows.flatMap(row => columns.map(col => row[col]));

      try {
        await pool.query(`
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES ${placeholders}
          ON CONFLICT DO NOTHING
        `, values);
        console.log(`Restored ${rows.length} rows to table ${table}`);
      } catch (err) {
        console.error(`Failed to restore table ${table}:`, err.message);
      }
    }
  }

  async restoreRedis(data) {
    const pipeline = redis.multi();

    for (const [key, { type, value }] of Object.entries(data)) {
      switch (type) {
        case 'string':
          pipeline.set(key, value);
          break;
        case 'hash':
          for (const [field, fieldValue] of Object.entries(value)) {
            pipeline.hSet(key, field, fieldValue);
          }
          break;
        case 'set':
          for (const member of value) {
            pipeline.sAdd(key, member);
          }
          break;
        case 'zset':
          for (const { score, value: member } of value) {
            pipeline.zAdd(key, { score, value: member });
          }
          break;
        case 'list':
          for (const item of value) {
            pipeline.rPush(key, item);
          }
          break;
      }
    }

    await pipeline.exec();
    console.log(`Restored ${Object.keys(data).length} keys to Redis`);
  }

  async loadBackupFromFile(filename) {
    const filePath = join(BACKUP_DIR, filename);
    const content = await import('fs').then(fs => fs.promises.readFile(filePath, 'utf-8'));
    return JSON.parse(content);
  }

  async getBackupRecord(backupId) {
    const result = await pool.query(
      'SELECT * FROM backups WHERE id = $1',
      [backupId]
    );
    return result.rows[0];
  }

  async listBackups(options = {}) {
    const { limit = 50, offset = 0, includeExpired = false } = options;

    let query = 'SELECT * FROM backups';
    const params = [];

    if (!includeExpired) {
      query += ' WHERE retention_until > NOW()';
    }

    query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async deleteBackup(backupId) {
    const backup = await this.getBackupRecord(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const fs = await import('fs').then(m => m.promises);
    try {
      await fs.unlink(join(BACKUP_DIR, backup.filename));
    } catch (err) {
      console.warn('Failed to delete backup file:', err.message);
    }

    await pool.query('DELETE FROM backups WHERE id = $1', [backupId]);
    this.activeBackups.delete(backupId);

    return true;
  }

  async getBackupDownloadUrl(backupId) {
    const backup = await this.getBackupRecord(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: backup.filename,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  }

  async cleanupExpiredBackups() {
    const result = await pool.query(`
      DELETE FROM backups 
      WHERE retention_until < NOW()
      RETURNING id, filename
    `);

    const fs = await import('fs').then(m => m.promises);
    for (const backup of result.rows) {
      try {
        await fs.unlink(join(BACKUP_DIR, backup.filename));
      } catch (err) {
        console.warn(`Failed to delete expired backup ${backup.filename}:`, err.message);
      }
      this.activeBackups.delete(backup.id);
    }

    console.log(`Cleaned up ${result.rowCount} expired backups`);
    return result.rowCount;
  }
}

const backupService = new BackupService();

export default backupService;
