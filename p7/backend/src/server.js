import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { initDB } from './db/postgres.js';
import { initInfluxDB } from './db/influxdb.js';
import { 
  getYDoc, 
  addConnection, 
  removeConnection, 
  broadcastToDocument, 
  updateCursor,
  getDocumentUsers
} from './services/collabService.js';
import { 
  createDocument, 
  getDocument, 
  getSnapshots, 
  revertToSnapshot 
} from './services/documentService.js';
import {
  logAction,
  getAuditLogs,
  getAuditStats,
  ACTION_TYPES,
  flushAllLogs
} from './services/auditService.js';
import anomalyService from './services/anomalyDetectionService.js';
import stateManager from './services/stateManager.js';
import backupService from './services/backupService.js';
import batchWriter from './services/batchWriter.js';
import sessionManager from './services/sessionManager.js';
import crdtPersistence from './services/crdtPersistence.js';
import * as Y from 'yjs';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.post('/api/documents', async (req, res) => {
  try {
    const { name, initialContent } = req.body;
    const doc = await createDocument(name, initialContent);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/snapshots', async (req, res) => {
  try {
    const snapshots = await getSnapshots(req.params.id);
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/revert/:snapshotId', async (req, res) => {
  try {
    const result = await revertToSnapshot(req.params.id, req.params.snapshotId);
    broadcastToDocument(req.params.id, {
      type: 'DOCUMENT_REVERTED',
      payload: result
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/audit', async (req, res) => {
  try {
    const { userId, actionType, startTime, endTime, limit, offset } = req.query;
    const logs = await getAuditLogs(req.params.id, {
      userId,
      actionType,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/audit/stats', async (req, res) => {
  try {
    const stats = await getAuditStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anomaly/rules', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const rules = await anomalyService.getAllRules(deviceId);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/anomaly/rules/:ruleName', async (req, res) => {
  try {
    const { deviceId, ...config } = req.body;
    const result = await anomalyService.setRule(req.params.ruleName, config, deviceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/anomaly/rules/:ruleName', async (req, res) => {
  try {
    const { deviceId } = req.query;
    await anomalyService.deleteRule(req.params.ruleName, deviceId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anomaly/detections', async (req, res) => {
  try {
    const detections = await anomalyService.getDetections(req.query);
    res.json(detections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anomaly/stats', async (req, res) => {
  try {
    const stats = await anomalyService.getDetectionStats(req.query.timeRange);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const stats = await stateManager.getInstanceStats();
    const batchStats = batchWriter.getStats();
    res.json({
      status: 'healthy',
      instance: stats,
      batchWriter: batchStats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.get('/api/instances', async (req, res) => {
  try {
    const instances = await stateManager.getAllInstances();
    res.json({ instances, count: instances.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups', async (req, res) => {
  try {
    const result = await backupService.createBackup(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups', async (req, res) => {
  try {
    const backups = await backupService.listBackups(req.query);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/:id/restore', async (req, res) => {
  try {
    const result = await backupService.restoreBackup(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/backups/:id', async (req, res) => {
  try {
    await backupService.deleteBackup(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups/:id/download', async (req, res) => {
  try {
    const url = await backupService.getBackupDownloadUrl(req.params.id);
    res.json({ downloadUrl: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const instanceStats = await stateManager.getInstanceStats();
    const batchStats = batchWriter.getStats();
    const sessionStats = await sessionManager.getStats();
    const crdtStats = await crdtPersistence.getMemoryStats();
    
    res.json({
      instance: instanceStats,
      batchWriter: batchStats,
      sessions: sessionStats,
      crdt: crdtStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/stats', async (req, res) => {
  try {
    const stats = await sessionManager.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/document/:documentId', async (req, res) => {
  try {
    const sessions = await sessionManager.getDocumentSessions(req.params.documentId);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/activity/:documentId', async (req, res) => {
  try {
    const activity = await sessionManager.getSessionActivity(req.params.documentId);
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crdt/snapshot/:documentId', async (req, res) => {
  try {
    const ydoc = await getYDoc(req.params.documentId);
    const success = await crdtPersistence.saveSnapshot(req.params.documentId, ydoc);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/audit', async (req, res) => {
  try {
    const { userId, actionType, startTime, endTime, limit, offset } = req.query;
    const logs = await getAuditLogs(req.params.id, {
      userId,
      actionType,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/audit/stats', async (req, res) => {
  try {
    const stats = await getAuditStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const perDocumentUpdateBuffers = new Map();
const perDocumentFlushTimers = new Map();
const UPDATE_FLUSH_INTERVAL = 25;

const flushDocumentUpdates = async (documentId, ydoc) => {
  const buffer = perDocumentUpdateBuffers.get(documentId);
  if (!buffer || buffer.length === 0) return;

  try {
    const mergedUpdate = Y.mergeUpdates(buffer);
    Y.applyUpdate(ydoc, mergedUpdate);
    broadcastToDocument(documentId, {
      type: 'UPDATE',
      payload: { 
        update: Array.from(mergedUpdate), 
        userId: 'server' 
      }
    });
  } catch (err) {
    console.error('Failed to apply merged update:', err);
  } finally {
    buffer.length = 0;
    perDocumentFlushTimers.delete(documentId);
  }
};

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const documentId = url.searchParams.get('documentId');
  const userId = url.searchParams.get('userId') || uuidv4();
  const userName = url.searchParams.get('userName') || 'Anonymous';
  const userColor = url.searchParams.get('userColor') || '#' + Math.floor(Math.random()*16777215).toString(16);
  const ipAddress = req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!documentId) {
    ws.close(1008, 'documentId required');
    return;
  }

  const ydoc = await getYDoc(documentId);
  const ytext = ydoc.getText('content');
  
  addConnection(documentId, userId, ws, { name: userName, color: userColor });
  logAction(documentId, userId, userName, ACTION_TYPES.CONNECTION, null, ipAddress, userAgent);

  const syncStep1 = Y.encodeStateAsUpdate(ydoc);
  try {
    ws.send(JSON.stringify({
      type: 'SYNC',
      payload: {
        update: Array.from(syncStep1),
        content: ytext.toString()
      }
    }));
  } catch (err) {
    console.error('Failed to send sync:', err);
  }

  let messageBuffer = [];
  let processing = false;

  const processMessages = async () => {
    if (processing || messageBuffer.length === 0) return;
    processing = true;

    while (messageBuffer.length > 0) {
      const data = messageBuffer.shift();
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'UPDATE':
            const update = new Uint8Array(message.payload.update);
            
            if (!perDocumentUpdateBuffers.has(documentId)) {
              perDocumentUpdateBuffers.set(documentId, []);
            }
            const buffer = perDocumentUpdateBuffers.get(documentId);
            buffer.push(update);
            
            if (!perDocumentFlushTimers.has(documentId)) {
              const timer = setTimeout(
                () => flushDocumentUpdates(documentId, ydoc),
                UPDATE_FLUSH_INTERVAL
              );
              perDocumentFlushTimers.set(documentId, timer);
            }
            logAction(documentId, userId, userName, ACTION_TYPES.EDIT, {
              updateSize: message.payload.update.length
            }, ipAddress, userAgent);
            break;
            
          case 'HEARTBEAT':
            try {
              ws.send(JSON.stringify({
                type: 'HEARTBEAT_ACK',
                payload: { timestamp: Date.now(), received: message.payload.timestamp }
              }));
            } catch (e) { console.error('Heartbeat ack failed:', e); }
            break;
            
          case 'CURSOR':
            updateCursor(documentId, userId, message.payload.cursor);
            logAction(documentId, userId, userName, ACTION_TYPES.CURSOR_MOVE, {
              position: message.payload.cursor?.position
            }, ipAddress, userAgent);
            break;
            
          case 'GET_USERS':
            const users = getDocumentUsers(documentId);
            try {
              ws.send(JSON.stringify({
                type: 'USERS_LIST',
                payload: { users }
              }));
            } catch (err) {
              console.error('Failed to send users list:', err);
            }
            break;
        }
      } catch (err) {
        console.error('Message processing error:', err);
      }
    }
    
    processing = false;
  };

  ws.on('message', async (data) => {
    messageBuffer.push(data);
    setImmediate(processMessages);
  });

  ws.on('close', () => {
    if (perDocumentFlushTimers.has(documentId)) {
      clearTimeout(perDocumentFlushTimers.get(documentId));
      flushDocumentUpdates(documentId, ydoc);
    }
    logAction(documentId, userId, userName, ACTION_TYPES.DISCONNECTION, null, ipAddress, userAgent);
    removeConnection(documentId, userId);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    removeConnection(documentId, userId);
  });
});

const startServer = async () => {
  try {
    await initDB();
    await initInfluxDB();
    await anomalyService.init();
    await stateManager.init();
    await sessionManager.init();
    await crdtPersistence.init();
    
    setInterval(async () => {
      await batchWriter.flushAll();
    }, 5000);

    setInterval(async () => {
      await backupService.cleanupExpiredBackups();
    }, 3600000);

    setInterval(async () => {
      const instances = await stateManager.getAllInstances();
      for (const docId of instances) {
        const ydoc = await getYDoc(docId);
        if (ydoc) {
          await crdtPersistence.saveSnapshot(docId, ydoc);
        }
      }
    }, 300000);

    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      await batchWriter.flushAll();
      sessionManager.shutdown();
      await stateManager.shutdown();
      process.exit(0);
    });

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`WebSocket server ready`);
      console.log(`Instance ID: ${stateManager.instanceId}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
