import redis from '../db/redis.js';
import stateManager from './stateManager.js';
import { v4 as uuidv4 } from 'uuid';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 3600 * 24;
const IDLE_TIMEOUT = 1800;
const HEARTBEAT_INTERVAL = 30000;
const CLEANUP_INTERVAL = 60000;

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupTimer = null;
    this.heartbeatTimers = new Map();
  }

  async init() {
    this.startCleanupTimer();
    console.log('Session manager initialized');
  }

  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, CLEANUP_INTERVAL);
  }

  async createSession(userId, documentId, connectionId = null, metadata = {}) {
    const sessionId = uuidv4();
    const now = Date.now();

    const session = {
      id: sessionId,
      userId,
      documentId,
      connectionId: connectionId || uuidv4(),
      createdAt: now,
      lastActiveAt: now,
      heartbeatCount: 0,
      status: 'active',
      metadata: {
        userAgent: metadata.userAgent || '',
        ipAddress: metadata.ipAddress || '',
        ...metadata,
      },
    };

    await redis.hSet(
      `${SESSION_PREFIX}${sessionId}`,
      Object.entries(session).reduce((acc, [k, v]) => {
        acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return acc;
      }, {})
    );
    await redis.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL);

    await redis.sAdd(`${SESSION_PREFIX}doc:${documentId}`, sessionId);
    await redis.sAdd(`${SESSION_PREFIX}user:${userId}`, sessionId);

    this.sessions.set(sessionId, session);

    return session;
  }

  async getSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const data = await redis.hGetAll(`${SESSION_PREFIX}${sessionId}`);
    if (Object.keys(data).length === 0) return null;

    const session = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        session[k] = JSON.parse(v);
      } catch {
        session[k] = v;
      }
    }

    session.createdAt = parseInt(session.createdAt);
    session.lastActiveAt = parseInt(session.lastActiveAt);
    session.heartbeatCount = parseInt(session.heartbeatCount);

    this.sessions.set(sessionId, session);
    return session;
  }

  async updateHeartbeat(sessionId) {
    const now = Date.now();
    const session = await this.getSession(sessionId);
    
    if (!session) return false;

    session.lastActiveAt = now;
    session.heartbeatCount++;
    session.status = 'active';

    await redis.hSet(`${SESSION_PREFIX}${sessionId}`, {
      lastActiveAt: now.toString(),
      heartbeatCount: session.heartbeatCount.toString(),
      status: 'active',
    });

    this.sessions.set(sessionId, session);
    return true;
  }

  async endSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    await redis.del(`${SESSION_PREFIX}${sessionId}`);
    await redis.sRem(`${SESSION_PREFIX}doc:${session.documentId}`, sessionId);
    await redis.sRem(`${SESSION_PREFIX}user:${session.userId}`, sessionId);

    this.sessions.delete(sessionId);

    return true;
  }

  async cleanupIdleSessions() {
    const now = Date.now();
    const cutoff = now - IDLE_TIMEOUT * 1000;
    const cleaned = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActiveAt < cutoff) {
        session.status = 'idle';
        await this.endSession(sessionId);
        cleaned.push({
          sessionId,
          userId: session.userId,
          documentId: session.documentId,
          idleFor: (now - session.lastActiveAt) / 1000,
        });
      }
    }

    if (cleaned.length > 0) {
      console.log(`Cleaned up ${cleaned.length} idle sessions`);
    }

    return cleaned;
  }

  async getDocumentSessions(documentId) {
    const sessionIds = await redis.sMembers(`${SESSION_PREFIX}doc:${documentId}`);
    const sessions = [];

    for (const sid of sessionIds) {
      const session = await this.getSession(sid);
      if (session) sessions.push(session);
    }

    return sessions;
  }

  async getUserSessions(userId) {
    const sessionIds = await redis.sMembers(`${SESSION_PREFIX}user:${userId}`);
    const sessions = [];

    for (const sid of sessionIds) {
      const session = await this.getSession(sid);
      if (session) sessions.push(session);
    }

    return sessions;
  }

  async getAllActiveSessions() {
    const active = [];
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        active.push(session);
      }
    }
    return active;
  }

  async getStats() {
    const activeCount = this.sessions.size;
    const docKeys = await redis.keys(`${SESSION_PREFIX}doc:*`);
    const userKeys = await redis.keys(`${SESSION_PREFIX}user:*`);

    return {
      activeSessions: activeCount,
      activeDocuments: docKeys.length,
      activeUsers: userKeys.length,
      idleTimeoutSeconds: IDLE_TIMEOUT,
      cleanupIntervalSeconds: CLEANUP_INTERVAL / 1000,
    };
  }

  async forceCleanupDocument(documentId) {
    const sessionIds = await redis.sMembers(`${SESSION_PREFIX}doc:${documentId}`);
    const results = [];

    for (const sid of sessionIds) {
      await this.endSession(sid);
      results.push(sid);
    }

    return results;
  }

  async extendSession(sessionId, ttl = SESSION_TTL) {
    const exists = await redis.exists(`${SESSION_PREFIX}${sessionId}`);
    if (!exists) return false;

    await redis.expire(`${SESSION_PREFIX}${sessionId}`, ttl);
    return true;
  }

  async getSessionActivity(documentId, limit = 50) {
    const sessions = await this.getDocumentSessions(documentId);
    
    return sessions
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, limit)
      .map(s => ({
        userId: s.userId,
        sessionId: s.id,
        connectedAt: new Date(s.createdAt),
        lastActiveAt: new Date(s.lastActiveAt),
        duration: (s.lastActiveAt - s.createdAt) / 1000,
        heartbeatCount: s.heartbeatCount,
        status: s.status,
      }));
  }

  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.heartbeatTimers.forEach(timer => clearInterval(timer));
    this.heartbeatTimers.clear();
    console.log('Session manager shutdown');
  }
}

const sessionManager = new SessionManager();

export default sessionManager;
export { IDLE_TIMEOUT, SESSION_TTL };
