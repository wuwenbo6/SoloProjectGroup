import redis from '../db/redis.js';
import { v4 as uuidv4 } from 'uuid';

const SESSION_TTL = 86400;
const CONNECTION_KEY_PREFIX = 'ws_connection';
const DOCUMENT_LOCK_KEY_PREFIX = 'document_lock';

class StateManager {
  constructor() {
    this.instanceId = uuidv4();
    this.localConnections = new Map();
    this.pubSub = redis.duplicate();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    await this.pubSub.connect();
    
    this.pubSub.subscribe('ws_broadcast', (message) => {
      this.handleBroadcastMessage(JSON.parse(message));
    });

    this.pubSub.subscribe('document_update', (message) => {
      this.handleDocumentUpdate(JSON.parse(message));
    });

    console.log(`StateManager initialized, instanceId: ${this.instanceId}`);
    this.initialized = true;
  }

  async registerConnection(connectionId, userId, documentId, data = {}) {
    const sessionData = {
      connectionId,
      userId,
      documentId,
      instanceId: this.instanceId,
      connectedAt: Date.now(),
      ...data,
    };

    await redis.hSet(
      `${CONNECTION_KEY_PREFIX}:${connectionId}`,
      Object.entries(sessionData).map(([k, v]) => ({ field: k, value: JSON.stringify(v) }))
    );
    await redis.expire(`${CONNECTION_KEY_PREFIX}:${connectionId}`, SESSION_TTL);

    await redis.sAdd(`${CONNECTION_KEY_PREFIX}:document:${documentId}`, connectionId);
    await redis.sAdd(`${CONNECTION_KEY_PREFIX}:user:${userId}`, connectionId);

    this.localConnections.set(connectionId, sessionData);

    return sessionData;
  }

  async unregisterConnection(connectionId) {
    const session = await this.getConnection(connectionId);
    if (!session) return;

    await redis.del(`${CONNECTION_KEY_PREFIX}:${connectionId}`);
    await redis.sRem(`${CONNECTION_KEY_PREFIX}:document:${session.documentId}`, connectionId);
    await redis.sRem(`${CONNECTION_KEY_PREFIX}:user:${session.userId}`, connectionId);

    this.localConnections.delete(connectionId);
  }

  async getConnection(connectionId) {
    if (this.localConnections.has(connectionId)) {
      return this.localConnections.get(connectionId);
    }

    const data = await redis.hGetAll(`${CONNECTION_KEY_PREFIX}:${connectionId}`);
    if (Object.keys(data).length === 0) return null;

    const session = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        session[k] = JSON.parse(v);
      } catch {
        session[k] = v;
      }
    }
    return session;
  }

  async getDocumentConnections(documentId) {
    const connectionIds = await redis.sMembers(`${CONNECTION_KEY_PREFIX}:document:${documentId}`);
    const connections = [];

    for (const connId of connectionIds) {
      const conn = await this.getConnection(connId);
      if (conn) connections.push(conn);
    }

    return connections;
  }

  async getUserConnections(userId) {
    const connectionIds = await redis.sMembers(`${CONNECTION_KEY_PREFIX}:user:${userId}`);
    const connections = [];

    for (const connId of connectionIds) {
      const conn = await this.getConnection(connId);
      if (conn) connections.push(conn);
    }

    return connections;
  }

  async broadcastToDocument(documentId, message, excludeInstanceId = null) {
    const payload = {
      documentId,
      message,
      excludeInstanceId,
      sourceInstanceId: this.instanceId,
      timestamp: Date.now(),
    };

    await redis.publish('ws_broadcast', JSON.stringify(payload));
  }

  handleBroadcastMessage(payload) {
    if (payload.excludeInstanceId === this.instanceId) return;

    this.emit('broadcast', payload);
  }

  handleDocumentUpdate(payload) {
    this.emit('document_update', payload);
  }

  async acquireDocumentLock(documentId, lockTimeout = 5000) {
    const lockKey = `${DOCUMENT_LOCK_KEY_PREFIX}:${documentId}`;
    const lockValue = uuidv4();
    
    const acquired = await redis.set(lockKey, lockValue, 'PX', lockTimeout, 'NX');
    
    if (acquired) {
      return { acquired: true, lockValue };
    }
    
    return { acquired: false };
  }

  async releaseDocumentLock(documentId, lockValue) {
    const lockKey = `${DOCUMENT_LOCK_KEY_PREFIX}:${documentId}`;
    const currentValue = await redis.get(lockKey);
    
    if (currentValue === lockValue) {
      await redis.del(lockKey);
      return true;
    }
    
    return false;
  }

  async getInstanceStats() {
    const localCount = this.localConnections.size;
    const totalKeys = await redis.dbSize();

    return {
      instanceId: this.instanceId,
      localConnections: localCount,
      totalRedisKeys: totalKeys,
      timestamp: new Date().toISOString(),
    };
  }

  async getAllInstances() {
    const instances = new Set();
    const keys = await redis.keys(`${CONNECTION_KEY_PREFIX}:*`);
    
    for (const key of keys) {
      if (key.startsWith(`${CONNECTION_KEY_PREFIX}:`)) {
        const data = await redis.hGetAll(key);
        if (data.instanceId) {
          instances.add(JSON.parse(data.instanceId));
        }
      }
    }

    return Array.from(instances);
  }

  async setSessionData(connectionId, key, value) {
    await redis.hSet(
      `${CONNECTION_KEY_PREFIX}:${connectionId}`,
      key,
      JSON.stringify(value)
    );
  }

  async getSessionData(connectionId, key) {
    const value = await redis.hGet(`${CONNECTION_KEY_PREFIX}:${connectionId}`, key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async publishDocumentUpdate(documentId, updateData) {
    const payload = {
      documentId,
      updateData,
      sourceInstanceId: this.instanceId,
      timestamp: Date.now(),
    };
    await redis.publish('document_update', JSON.stringify(payload));
  }

  on(event, callback) {
    if (!this.listeners) this.listeners = new Map();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.listeners || !this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => cb(data));
  }

  async shutdown() {
    for (const connId of this.localConnections.keys()) {
      await this.unregisterConnection(connId);
    }
    await this.pubSub.quit();
  }
}

const stateManager = new StateManager();

export default stateManager;
