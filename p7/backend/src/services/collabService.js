import { v4 as uuidv4 } from 'uuid';
import redis from '../db/redis.js';
import * as Y from 'yjs';
import { createSnapshot } from './documentService.js';
import { config } from '../config.js';

const documents = new Map();
const connections = new Map();
const snapshotTimers = new Map();

const messageQueues = new Map();
const flushIntervals = new Map();
const BATCH_FLUSH_INTERVAL = 30;
const MAX_BATCH_SIZE = 50;

export const getYDoc = async (documentId) => {
  if (documents.has(documentId)) {
    return documents.get(documentId);
  }

  const ydoc = new Y.Doc();
  const content = await redis.get(`document:${documentId}:content`);
  if (content) {
    const ytext = ydoc.getText('content');
    ytext.insert(0, content);
  }
  
  documents.set(documentId, ydoc);
  startSnapshotTimer(documentId);
  
  return ydoc;
};

const startSnapshotTimer = (documentId) => {
  if (snapshotTimers.has(documentId)) {
    clearInterval(snapshotTimers.get(documentId));
  }

  const timer = setInterval(async () => {
    await autoSnapshot(documentId);
  }, config.snapshotInterval);

  snapshotTimers.set(documentId, timer);
};

const autoSnapshot = async (documentId) => {
  const ydoc = documents.get(documentId);
  if (!ydoc) return;

  const content = ydoc.getText('content').toString();
  const versionStr = await redis.get(`document:${documentId}:version`);
  const version = parseInt(versionStr || '0') + 1;
  
  await createSnapshot(documentId, content, version);
  await redis.set(`document:${documentId}:version`, version);
  await redis.set(`document:${documentId}:content`, content);
  
  broadcastToDocument(documentId, {
    type: 'SNAPSHOT_CREATED',
    payload: { version, timestamp: Date.now() }
  });
};

export const addConnection = (documentId, userId, ws, userInfo) => {
  const docConnections = connections.get(documentId) || new Map();
  docConnections.set(userId, { ws, userInfo, cursor: null });
  connections.set(documentId, docConnections);
  
  broadcastUserPresence(documentId);
};

export const removeConnection = (documentId, userId) => {
  const docConnections = connections.get(documentId);
  if (docConnections) {
    docConnections.delete(userId);
    if (docConnections.size === 0) {
      connections.delete(documentId);
      
      if (flushIntervals.has(documentId)) {
        clearTimeout(flushIntervals.get(documentId));
        flushIntervals.delete(documentId);
      }
      flushMessageQueue(documentId);
      messageQueues.delete(documentId);
      
      if (snapshotTimers.has(documentId)) {
        clearInterval(snapshotTimers.get(documentId));
        snapshotTimers.delete(documentId);
      }
      if (documents.has(documentId)) {
        autoSnapshot(documentId);
        documents.delete(documentId);
      }
    } else {
      debouncedBroadcastPresence(documentId);
    }
  }
};

const presenceDebounceTimers = new Map();
export const debouncedBroadcastPresence = (documentId) => {
  if (presenceDebounceTimers.has(documentId)) {
    clearTimeout(presenceDebounceTimers.get(documentId));
  }
  const timer = setTimeout(() => {
    broadcastUserPresence(documentId);
    presenceDebounceTimers.delete(documentId);
  }, 100);
  presenceDebounceTimers.set(documentId, timer);
};

const flushMessageQueue = (documentId) => {
  const queue = messageQueues.get(documentId);
  if (!queue || queue.length === 0) return;

  const docConnections = connections.get(documentId);
  if (!docConnections) return;

  while (queue.length > 0) {
    const batchSize = Math.min(queue.length, MAX_BATCH_SIZE);
    const batch = queue.splice(0, batchSize);
    
    batch.forEach(({ message, excludeUserId }) => {
      const messageStr = JSON.stringify(message);
      docConnections.forEach((conn, userId) => {
        if (userId !== excludeUserId && conn.ws.readyState === 1) {
          try {
            conn.ws.send(messageStr, { binary: false });
          } catch (err) {
            console.error('Failed to send message:', err);
          }
        }
      });
    });
  }
};

export const broadcastToDocument = (documentId, message, excludeUserId = null) => {
  const docConnections = connections.get(documentId);
  if (!docConnections) return;

  if (!messageQueues.has(documentId)) {
    messageQueues.set(documentId, []);
  }
  const queue = messageQueues.get(documentId);

  queue.push({ message, excludeUserId });

  if (queue.length >= MAX_BATCH_SIZE) {
    setImmediate(() => flushMessageQueue(documentId));
  } else if (!flushIntervals.has(documentId)) {
    const timer = setTimeout(() => {
      flushMessageQueue(documentId);
      flushIntervals.delete(documentId);
    }, BATCH_FLUSH_INTERVAL);
    flushIntervals.set(documentId, timer);
  }
};

export const broadcastUserPresence = (documentId) => {
  const docConnections = connections.get(documentId);
  if (!docConnections) return;

  const users = [];
  docConnections.forEach((conn, userId) => {
    users.push({
      id: userId,
      ...conn.userInfo,
      cursor: conn.cursor
    });
  });

  broadcastToDocument(documentId, {
    type: 'USERS_PRESENCE',
    payload: { users }
  });
};

export const updateCursor = (documentId, userId, cursor) => {
  const docConnections = connections.get(documentId);
  if (!docConnections || !docConnections.has(userId)) return;

  const conn = docConnections.get(userId);
  conn.cursor = cursor;
  
  debouncedBroadcastPresence(documentId);
};

export const getDocumentUsers = (documentId) => {
  const docConnections = connections.get(documentId);
  if (!docConnections) return [];

  const users = [];
  docConnections.forEach((conn, userId) => {
    users.push({
      id: userId,
      ...conn.userInfo
    });
  });
  return users;
};
