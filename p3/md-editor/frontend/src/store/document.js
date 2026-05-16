import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import Dexie from 'dexie';

const db = new Dexie('MDNotesDB');
db.version(2).stores({
  documents: 'id, title, updatedAt',
  yjsUpdates: '++id, documentId, timestamp',
  pendingUploads: '++id, documentId'
});

export const useDocumentStore = defineStore('document', () => {
  const socket = ref(null);
  const isConnected = ref(false);
  const isOnline = ref(navigator.onLine);

  const currentDocumentId = ref(null);
  const ydoc = ref(null);
  const ytext = ref(null);
  const ytitle = ref(null);

  const content = ref('');
  const title = ref('');

  const onlineUsers = ref([]);
  const clientId = ref(localStorage.getItem('clientId') || uuidv4());
  const userName = ref('User-' + clientId.value.slice(0, 6));
  const pendingUpdates = ref([]);

  localStorage.setItem('clientId', clientId.value);

  function connect() {
    if (socket.value) return;

    socket.value = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.value.on('connect', () => {
      isConnected.value = true;
      console.log('Connected to server');
      if (currentDocumentId.value) {
        joinDocument(currentDocumentId.value);
      }
    });

    socket.value.on('disconnect', () => {
      isConnected.value = false;
      console.log('Disconnected from server');
    });

    socket.value.on('document-sync', async (data) => {
      try {
        if (!ydoc.value) {
          initYDoc();
        }

        const state = Uint8Array.from(atob(data.state), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc.value, state);

        await saveDocumentState();

        content.value = ytext.value.toString();
        title.value = ytitle.value.toString();
      } catch (error) {
        console.error('Error syncing document:', error);
      }
    });

    socket.value.on('update', async (data) => {
      try {
        if (!ydoc.value) return;
        const update = Uint8Array.from(atob(data.update), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc.value, update);
        await saveDocumentState();
      } catch (error) {
        console.error('Error applying remote update:', error);
      }
    });

    socket.value.on('sync-complete', async (data) => {
      try {
        if (!ydoc.value) {
          initYDoc();
        }

        const state = Uint8Array.from(atob(data.state), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc.value, state);

        await db.yjsUpdates.where('documentId').equals(currentDocumentId.value).delete();
        pendingUpdates.value = [];

        await saveDocumentState();

        content.value = data.content;
        title.value = data.title;

        console.log('Offline sync completed');
      } catch (error) {
        console.error('Error completing sync:', error);
      }
    });

    socket.value.on('user-joined', ({ users }) => {
      onlineUsers.value = users;
    });

    socket.value.on('user-left', ({ users }) => {
      onlineUsers.value = users;
    });

    socket.value.on('permission-changed', ({ isPublic }) => {
      console.log('Permission changed:', isPublic);
    });

    socket.value.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  function initYDoc() {
    ydoc.value = new Y.Doc();
    ytext.value = ydoc.value.getText('content');
    ytitle.value = ydoc.value.getText('title');

    ydoc.value.on('update', async (update, origin) => {
      if (origin !== socket.value) {
        const updateBase64 = btoa(String.fromCharCode.apply(null, update));

        if (isOnline.value && isConnected.value) {
          socket.value.emit('update', {
            documentId: currentDocumentId.value,
            update: updateBase64
          });
        } else {
          pendingUpdates.value.push(updateBase64);
          await db.yjsUpdates.add({
            documentId: currentDocumentId.value,
            update: updateBase64,
            timestamp: Date.now()
          });
        }

        content.value = ytext.value.toString();
        title.value = ytitle.value.toString();
        await saveDocumentState();
      }
    });
  }

  async function saveDocumentState() {
    if (!currentDocumentId.value || !ydoc.value) return;

    const state = Y.encodeStateAsUpdate(ydoc.value);
    await db.documents.put({
      id: currentDocumentId.value,
      title: title.value,
      content: content.value,
      yjsState: btoa(String.fromCharCode.apply(null, state)),
      updatedAt: new Date()
    });
  }

  async function loadLocalDocument(documentId) {
    const localDoc = await db.documents.get(documentId);
    if (localDoc && localDoc.yjsState) {
      try {
        if (!ydoc.value) {
          initYDoc();
        }
        const state = Uint8Array.from(atob(localDoc.yjsState), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc.value, state);
        content.value = ytext.value.toString();
        title.value = ytitle.value.toString();
        return true;
      } catch (e) {
        console.log('Failed to load local state:', e);
      }
    }
    return false;
  }

  async function joinDocument(documentId) {
    if (!documentId) return;

    currentDocumentId.value = documentId;

    if (!ydoc.value) {
      initYDoc();
    }

    await loadLocalDocument(documentId);

    const pending = await db.yjsUpdates.where('documentId').equals(documentId).toArray();
    pendingUpdates.value = pending.map(p => p.update);

    if (isOnline.value && socket.value?.connected) {
      socket.value.emit('join-document', {
        documentId,
        userId: clientId.value,
        userName: userName.value
      });
    }
  }

  async function createNewDocument() {
    const newId = uuidv4();

    if (!ydoc.value) {
      initYDoc();
    }

    ytext.value.delete(0, ytext.value.length);
    ytitle.value.delete(0, ytitle.value.length);
    ytitle.value.insert(0, 'Untitled Document');

    await saveDocumentState();

    return newId;
  }

  async function syncOfflineChanges() {
    if (!isOnline.value || !isConnected.value || !currentDocumentId.value) return;

    const pending = await db.yjsUpdates.where('documentId').equals(currentDocumentId.value).toArray();

    if (pending.length > 0) {
      console.log(`Syncing ${pending.length} offline updates...`);
      socket.value.emit('sync-offline-changes', {
        documentId: currentDocumentId.value,
        updates: pending.map(p => p.update)
      });
    }
  }

  async function uploadImage(file) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('image', file);

      fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            resolve(data.url);
          } else {
            reject(new Error(data.error || 'Upload failed'));
          }
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  async function insertImageAtCursor(file, position) {
    try {
      const url = await uploadImage(file);
      const imageMarkdown = `\n![${file.name}](${url})\n`;

      if (ytext.value) {
        ytext.value.insert(position, imageMarkdown);
      }

      return url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  function setPermission(isPublic) {
    if (isConnected.value && currentDocumentId.value) {
      socket.value.emit('set-permission', {
        documentId: currentDocumentId.value,
        isPublic
      });
    }
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  }

  window.addEventListener('online', () => {
    isOnline.value = true;
    setTimeout(() => syncOfflineChanges(), 1000);
  });

  window.addEventListener('offline', () => {
    isOnline.value = false;
  });

  return {
    isConnected,
    isOnline,
    currentDocumentId,
    title,
    content,
    onlineUsers,
    clientId,
    userName,
    pendingUpdates,
    ydoc,
    ytext,
    ytitle,
    connect,
    disconnect,
    joinDocument,
    createNewDocument,
    setPermission,
    uploadImage,
    insertImageAtCursor
  };
});
