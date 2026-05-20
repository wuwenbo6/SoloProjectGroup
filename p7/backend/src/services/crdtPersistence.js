import pool from '../db/postgres.js';
import redis from '../db/redis.js';
import * as Y from 'yjs';

const DOCUMENT_CACHE_PREFIX = 'crdt:doc:';
const UPDATE_LOG_PREFIX = 'crdt:updates:';
const SNAPSHOT_VERSION_KEY = 'crdt:snapshot:version:';
const CACHE_TTL = 3600;
const MAX_UPDATE_LOG_SIZE = 1000;

class CRDTPersistence {
  constructor() {
    this.snapshotCache = new Map();
    this.pendingSnapshots = new Set();
  }

  async init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crdt_snapshots (
        document_id UUID PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        state_vector BYTEA NOT NULL,
        document_state BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crdt_update_logs (
        id SERIAL PRIMARY KEY,
        document_id UUID NOT NULL,
        update_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_crdt_updates_doc_id ON crdt_update_logs(document_id);
      CREATE INDEX IF NOT EXISTS idx_crdt_updates_created ON crdt_update_logs(created_at);
    `);

    console.log('CRDT persistence tables initialized');
  }

  async saveUpdate(documentId, update) {
    const updateBuffer = Buffer.from(update);
    
    await pool.query(`
      INSERT INTO crdt_update_logs (document_id, update_data)
      VALUES ($1, $2)
    `, [documentId, updateBuffer]);

    const logKey = `${UPDATE_LOG_PREFIX}${documentId}`;
    await redis.rPush(logKey, updateBuffer.toString('base64'));
    await redis.expire(logKey, CACHE_TTL);
    
    const logLength = await redis.lLen(logKey);
    if (logLength > MAX_UPDATE_LOG_SIZE) {
      await redis.lTrim(logKey, -MAX_UPDATE_LOG_SIZE, -1);
    }

    return true;
  }

  async saveSnapshot(documentId, ydoc, version = null) {
    if (this.pendingSnapshots.has(documentId)) {
      return false;
    }
    
    this.pendingSnapshots.add(documentId);
    
    try {
      const stateVector = Y.encodeStateVector(ydoc);
      const documentState = Y.encodeStateAsUpdate(ydoc);
      const svBuffer = Buffer.from(stateVector);
      const dsBuffer = Buffer.from(documentState);

      const newVersion = version || Date.now();

      await pool.query(`
        INSERT INTO crdt_snapshots (document_id, version, state_vector, document_state, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (document_id) 
        DO UPDATE SET 
          version = EXCLUDED.version,
          state_vector = EXCLUDED.state_vector,
          document_state = EXCLUDED.document_state,
          updated_at = NOW()
      `, [documentId, newVersion, svBuffer, dsBuffer]);

      const cacheKey = `${DOCUMENT_CACHE_PREFIX}${documentId}`;
      await redis.hSet(cacheKey, {
        version: newVersion.toString(),
        stateVector: svBuffer.toString('base64'),
        documentState: dsBuffer.toString('base64'),
      });
      await redis.expire(cacheKey, CACHE_TTL);

      await redis.del(`${UPDATE_LOG_PREFIX}${documentId}`);

      this.snapshotCache.set(documentId, {
        version: newVersion,
        stateVector: svBuffer,
        documentState: dsBuffer,
      });

      return true;
    } finally {
      this.pendingSnapshots.delete(documentId);
    }
  }

  async loadDocument(documentId) {
    const cacheKey = `${DOCUMENT_CACHE_PREFIX}${documentId}`;
    const cached = await redis.hGetAll(cacheKey);

    let stateVector = null;
    let documentState = null;

    if (cached && cached.documentState) {
      stateVector = Buffer.from(cached.stateVector, 'base64');
      documentState = Buffer.from(cached.documentState, 'base64');
    } else {
      const result = await pool.query(`
        SELECT state_vector, document_state, version
        FROM crdt_snapshots
        WHERE document_id = $1
      `, [documentId]);

      if (result.rows.length > 0) {
        stateVector = result.rows[0].state_vector;
        documentState = result.rows[0].document_state;
        
        await redis.hSet(cacheKey, {
          version: result.rows[0].version.toString(),
          stateVector: stateVector.toString('base64'),
          documentState: documentState.toString('base64'),
        });
        await redis.expire(cacheKey, CACHE_TTL);
      }
    }

    const ydoc = new Y.Doc();

    if (documentState) {
      Y.applyUpdate(ydoc, new Uint8Array(documentState));
    }

    const logKey = `${UPDATE_LOG_PREFIX}${documentId}`;
    const updates = await redis.lRange(logKey, 0, -1);
    
    for (const updateBase64 of updates) {
      const update = Buffer.from(updateBase64, 'base64');
      Y.applyUpdate(ydoc, new Uint8Array(update));
    }

    const dbUpdates = await pool.query(`
      SELECT update_data
      FROM crdt_update_logs
      WHERE document_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [documentId]);

    for (const row of dbUpdates.rows.reverse()) {
      Y.applyUpdate(ydoc, new Uint8Array(row.update_data));
    }

    return ydoc;
  }

  async getDocumentVersion(documentId) {
    const cacheKey = `${DOCUMENT_CACHE_PREFIX}${documentId}`;
    const cachedVersion = await redis.hGet(cacheKey, 'version');
    
    if (cachedVersion) {
      return parseInt(cachedVersion);
    }

    const result = await pool.query(`
      SELECT version FROM crdt_snapshots WHERE document_id = $1
    `, [documentId]);

    if (result.rows.length > 0) {
      return result.rows[0].version;
    }

    return 0;
  }

  async batchSnapshot(documentIds, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      for (const docId of batch) {
        try {
          const ydoc = await this.loadDocument(docId);
          const success = await this.saveSnapshot(docId, ydoc);
          results.push({ documentId: docId, success });
          ydoc.destroy();
        } catch (err) {
          console.error(`Failed to snapshot document ${docId}:`, err);
          results.push({ documentId: docId, success: false, error: err.message });
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  }

  async pruneOldUpdates(documentId, olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await pool.query(`
      DELETE FROM crdt_update_logs
      WHERE document_id = $1 AND created_at < $2
      RETURNING id
    `, [documentId, cutoff]);

    return result.rowCount;
  }

  async getMemoryStats() {
    const cacheSize = this.snapshotCache.size;
    const redisKeys = await redis.keys(`${DOCUMENT_CACHE_PREFIX}*`);
    const logKeys = await redis.keys(`${UPDATE_LOG_PREFIX}*`);
    
    const totalCacheKeys = redisKeys.length;
    const totalLogKeys = logKeys.length;

    return {
      memoryCacheSize: cacheSize,
      redisCacheKeys: totalCacheKeys,
      redisLogKeys: totalLogKeys,
      memoryCacheDocs: Array.from(this.snapshotCache.keys()),
    };
  }

  async clearCache(documentId = null) {
    if (documentId) {
      await redis.del(`${DOCUMENT_CACHE_PREFIX}${documentId}`);
      await redis.del(`${UPDATE_LOG_PREFIX}${documentId}`);
      this.snapshotCache.delete(documentId);
    } else {
      const cacheKeys = await redis.keys(`${DOCUMENT_CACHE_PREFIX}*`);
      const logKeys = await redis.keys(`${UPDATE_LOG_PREFIX}*`);
      
      if (cacheKeys.length > 0) {
        await redis.del(cacheKeys);
      }
      if (logKeys.length > 0) {
        await redis.del(logKeys);
      }
      
      this.snapshotCache.clear();
    }

    return true;
  }
}

const crdtPersistence = new CRDTPersistence();

export default crdtPersistence;
