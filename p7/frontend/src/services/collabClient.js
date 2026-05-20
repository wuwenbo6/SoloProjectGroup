import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

export class CollabClient {
  constructor(documentId, userId, userName, userColor) {
    this.documentId = documentId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('content');
    this.ws = null;
    this.monacoBinding = null;
    this.listeners = new Map();
    this.users = new Map();
    this.isApplyingRevert = false;
  }

  connect() {
    return new Promise(async (resolve, reject) => {
      await this.loadFromOfflineStorage();

      const wsUrl = new URL('ws://localhost:3001');
      wsUrl.searchParams.set('documentId', this.documentId);
      wsUrl.searchParams.set('userId', this.userId);
      wsUrl.searchParams.set('userName', this.userName);
      wsUrl.searchParams.set('userColor', this.userColor);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected');
        this.emit('disconnected');
        if (!event.wasClean) {
          setTimeout(() => {
            if (navigator.onLine) {
              this.reconnect();
            }
          }, 3000);
        }
      };

      let updateBuffer = [];
      let flushTimer = null;
      
      const flushUpdates = () => {
        if (updateBuffer.length === 0 || this.isApplyingRevert) return;
        
        try {
          const mergedUpdate = Y.mergeUpdates(updateBuffer);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'UPDATE',
              payload: { update: Array.from(mergedUpdate) }
            }));
          }
        } catch (e) {
          console.error('Failed to flush updates:', e);
        }
        updateBuffer = [];
        flushTimer = null;
      };

      this.ydoc.on('update', (update) => {
        if (this.isApplyingRevert) return;
        
        updateBuffer.push(update);
        if (!flushTimer) {
          flushTimer = setTimeout(flushUpdates, 50);
        }
      });

      this.flushUpdates = flushUpdates;
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'SYNC':
        const syncUpdate = new Uint8Array(message.payload.update);
        this.isApplyingRevert = true;
        try {
          Y.applyUpdate(this.ydoc, syncUpdate);
        } finally {
          this.isApplyingRevert = false;
        }
        this.emit('sync', message.payload);
        break;

      case 'UPDATE':
        if (message.payload.userId === this.userId) {
          break;
        }
        const update = new Uint8Array(message.payload.update);
        Y.applyUpdate(this.ydoc, update);
        break;

      case 'USERS_PRESENCE':
        this.users.clear();
        message.payload.users.forEach(user => {
          if (user.id !== this.userId) {
            this.users.set(user.id, user);
          }
        });
        this.emit('usersPresence', Array.from(this.users.values()));
        break;

      case 'SNAPSHOT_CREATED':
        this.emit('snapshotCreated', message.payload);
        break;

      case 'DOCUMENT_REVERTED':
        this.isApplyingRevert = true;
        try {
          const { content, version } = message.payload;
          const currentLength = this.ytext.length;
          if (currentLength > 0) {
            this.ytext.delete(0, currentLength);
          }
          if (content) {
            this.ytext.insert(0, content);
          }
          this.emit('documentReverted', message.payload);
        } finally {
          this.isApplyingRevert = false;
        }
        break;

      case 'USERS_LIST':
        this.emit('usersList', message.payload.users);
        break;
    }
  }

  bindMonaco(editor, monaco) {
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
    }
    this.monacoBinding = new MonacoBinding(
      this.ytext,
      editor.getModel(),
      new Set([editor]),
      monaco
    );

    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition();
      const selection = editor.getSelection();
      this.sendCursor(position, selection);
    });

    editor.onDidChangeCursorSelection(() => {
      const position = editor.getPosition();
      const selection = editor.getSelection();
      this.sendCursor(position, selection);
    });
  }

  sendCursor(position, selection) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'CURSOR',
        payload: {
          cursor: { position, selection }
        }
      }));
    }
  }

  getContent() {
    return this.ytext.toString();
  }

  async saveToOfflineStorage() {
    try {
      const state = Y.encodeStateAsUpdate(this.ydoc);
      const data = {
        documentId: this.documentId,
        state: Array.from(state),
        content: this.getContent(),
        timestamp: Date.now()
      };
      localStorage.setItem(`yjs_offline_${this.documentId}`, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save offline state:', err);
    }
  }

  async loadFromOfflineStorage() {
    try {
      const stored = localStorage.getItem(`yjs_offline_${this.documentId}`);
      if (stored) {
        const data = JSON.parse(stored);
        const state = new Uint8Array(data.state);
        Y.applyUpdate(this.ydoc, state);
        return true;
      }
    } catch (err) {
      console.error('Failed to load offline state:', err);
    }
    return false;
  }

  reconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    return this.connect();
  }

  disconnect() {
    this.saveToOfflineStorage();
    
    if (this.flushUpdates) {
      this.flushUpdates();
    }
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
    }
    if (this.ws) {
      this.ws.close();
    }
    this.ydoc.destroy();
    this.listeners.clear();
    this.users.clear();
  }
}
