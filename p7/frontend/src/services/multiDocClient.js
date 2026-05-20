import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

class DocumentConnection {
  constructor(documentId, userId, userName, userColor) {
    this.id = documentId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('content');
    this.ws = null;
    this.wsUrl = null;
    this.monacoBindings = new Map();
    this.remoteUsers = [];
    this.status = 'disconnected';
    this.lastActivity = Date.now();
    this.listeners = new Map();
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = new URL('ws://localhost:3001');
      wsUrl.searchParams.set('documentId', this.id);
      wsUrl.searchParams.set('userId', this.userId);
      wsUrl.searchParams.set('userName', this.userName);
      wsUrl.searchParams.set('userColor', this.userColor);

      this.wsUrl = wsUrl.toString();
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log(`Connected to document: ${this.id}`);
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error(`WebSocket error for document ${this.id}:`, error);
        this.status = 'error';
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log(`Disconnected from document: ${this.id}`);
        this.status = 'disconnected';
        this.emit('disconnected', event);

        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`Reconnecting attempt ${this.reconnectAttempts} in ${delay}ms...`);
          setTimeout(() => this.connect(), delay);
        }
      };

      this.ydoc.on('update', (update, origin) => {
        if (origin !== 'remote' && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'UPDATE',
            payload: { update: Array.from(update) }
          }));
        }
        this.lastActivity = Date.now();
      });
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'SYNC':
        const syncUpdate = new Uint8Array(message.payload.update);
        Y.applyUpdate(this.ydoc, syncUpdate, 'remote');
        this.emit('sync', message.payload);
        break;

      case 'UPDATE':
        if (message.payload.userId !== this.userId) {
          const update = new Uint8Array(message.payload.update);
          Y.applyUpdate(this.ydoc, update, 'remote');
        }
        break;

      case 'USERS_PRESENCE':
        this.remoteUsers = message.payload.users.filter(u => u.id !== this.userId);
        this.emit('usersPresence', this.remoteUsers);
        break;

      case 'SNAPSHOT_CREATED':
        this.emit('snapshotCreated', message.payload);
        break;

      case 'DOCUMENT_REVERTED':
        this.emit('documentReverted', message.payload);
        break;

      case 'HEARTBEAT_ACK':
        this.emit('heartbeatAck', message.payload);
        break;
    }
  }

  bindEditor(editorId, editor, monaco) {
    if (this.monacoBindings.has(editorId)) {
      this.monacoBindings.get(editorId).destroy();
    }

    const binding = new MonacoBinding(
      this.ytext,
      editor.getModel(),
      new Set([editor]),
      monaco
    );

    this.monacoBindings.set(editorId, binding);
    return binding;
  }

  unbindEditor(editorId) {
    const binding = this.monacoBindings.get(editorId);
    if (binding) {
      binding.destroy();
      this.monacoBindings.delete(editorId);
    }
  }

  sendCursor(position, selection) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'CURSOR',
        payload: { cursor: { position, selection } }
      }));
    }
  }

  sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'HEARTBEAT',
        payload: { timestamp: Date.now() }
      }));
    }
  }

  getContent() {
    return this.ytext.toString();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  disconnect() {
    this.monacoBindings.forEach(binding => binding.destroy());
    this.monacoBindings.clear();

    if (this.ws) {
      this.ws.close();
    }

    this.ydoc.destroy();
    this.listeners.clear();
    this.status = 'disconnected';
  }

  getIdleTime() {
    return (Date.now() - this.lastActivity) / 1000;
  }
}

class MultiDocClient {
  constructor(userId, userName, userColor) {
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
    this.connections = new Map();
    this.activeDocumentId = null;
    this.heartbeatTimer = null;
  }

  async openDocument(documentId, autoConnect = true) {
    if (this.connections.has(documentId)) {
      const conn = this.connections.get(documentId);
      if (conn.status === 'disconnected' && autoConnect) {
        await conn.connect();
      }
      this.activeDocumentId = documentId;
      return conn;
    }

    const conn = new DocumentConnection(
      documentId,
      this.userId,
      this.userName,
      this.userColor
    );

    if (autoConnect) {
      await conn.connect();
    }

    this.connections.set(documentId, conn);
    this.activeDocumentId = documentId;

    if (!this.heartbeatTimer) {
      this.startHeartbeat();
    }

    return conn;
  }

  closeDocument(documentId) {
    const conn = this.connections.get(documentId);
    if (conn) {
      conn.disconnect();
      this.connections.delete(documentId);
    }

    if (this.activeDocumentId === documentId) {
      this.activeDocumentId = this.connections.size > 0 
        ? Array.from(this.connections.keys())[0] 
        : null;
    }

    if (this.connections.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getDocument(documentId) {
    return this.connections.get(documentId);
  }

  getActiveDocument() {
    return this.activeDocumentId ? this.connections.get(this.activeDocumentId) : null;
  }

  setActiveDocument(documentId) {
    if (this.connections.has(documentId)) {
      this.activeDocumentId = documentId;
      return true;
    }
    return false;
  }

  getAllDocuments() {
    return Array.from(this.connections.entries()).map(([id, conn]) => ({
      id,
      status: conn.status,
      idleTime: conn.getIdleTime(),
      remoteUsers: conn.remoteUsers,
    }));
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach(conn => {
        if (conn.status === 'connected') {
          conn.sendHeartbeat();
        }
      });
    }, 30000);
  }

  shutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.connections.forEach(conn => conn.disconnect());
    this.connections.clear();
    this.activeDocumentId = null;
  }
}

export { DocumentConnection, MultiDocClient };
