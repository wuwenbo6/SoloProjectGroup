const Y = require('yjs');
const Document = require('../models/document');
const { v4: uuidv4 } = require('uuid');

const documents = new Map();

async function getOrCreateYDoc(documentId) {
  if (documents.has(documentId)) {
    return documents.get(documentId);
  }

  const ydoc = new Y.Doc();
  
  let doc = await Document.findById(documentId);
  if (doc && doc.yjsState) {
    try {
      Y.applyUpdate(ydoc, Buffer.from(doc.yjsState, 'base64'));
    } catch (e) {
      console.log('Failed to apply saved state, creating new:', e);
    }
  }
  
  documents.set(documentId, ydoc);
  return ydoc;
}

async function saveYDocState(documentId) {
  const ydoc = documents.get(documentId);
  if (!ydoc) return;

  const state = Y.encodeStateAsUpdate(ydoc);
  const content = ydoc.getText('content').toString();
  const title = ydoc.getText('title').toString() || 'Untitled Document';
  
  let doc = await Document.findById(documentId);
  if (!doc) {
    doc = new Document({ _id: documentId });
  }
  
  doc.yjsState = Buffer.from(state).toString('base64');
  doc.content = content;
  doc.title = title;
  doc.updatedAt = new Date();
  await doc.save();
}

module.exports = (io, redisClient) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let currentDocId = null;

    socket.on('join-document', async ({ documentId, userId, userName }) => {
      try {
        if (currentDocId) {
          socket.leave(currentDocId);
        }
        
        currentDocId = documentId;
        socket.join(documentId);
        
        const ydoc = await getOrCreateYDoc(documentId);
        
        const userKey = `doc:${documentId}:users`;
        await redisClient.hSet(userKey, socket.id, JSON.stringify({ 
          userId, 
          userName, 
          connectedAt: Date.now(),
          socketId: socket.id 
        }));
        
        const onlineUsers = await getOnlineUsers(redisClient, documentId);
        io.to(documentId).emit('user-joined', { users: onlineUsers });
        
        const stateVector = Y.encodeStateAsUpdate(ydoc);
        socket.emit('document-sync', {
          documentId,
          state: Buffer.from(stateVector).toString('base64'),
          version: ydoc.clientID
        });
        
      } catch (error) {
        console.error('Error joining document:', error);
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    socket.on('update', async ({ documentId, update }) => {
      try {
        const ydoc = await getOrCreateYDoc(documentId);
        const updateBuffer = Buffer.from(update, 'base64');
        
        Y.applyUpdate(ydoc, updateBuffer);
        
        socket.to(documentId).emit('update', {
          update,
          sender: socket.id
        });
        
        if (docSaveTimeouts.has(documentId)) {
          clearTimeout(docSaveTimeouts.get(documentId));
        }
        docSaveTimeouts.set(documentId, setTimeout(() => {
          saveYDocState(documentId);
          docSaveTimeouts.delete(documentId);
        }, 1000));
        
      } catch (error) {
        console.error('Error processing update:', error);
      }
    });

    socket.on('sync-offline-changes', async ({ documentId, updates, lastKnownState }) => {
      try {
        const ydoc = await getOrCreateYDoc(documentId);
        
        for (const update of updates) {
          try {
            const updateBuffer = Buffer.from(update, 'base64');
            Y.applyUpdate(ydoc, updateBuffer);
          } catch (e) {
            console.log('Skipping invalid update:', e);
          }
        }
        
        const stateVector = Y.encodeStateAsUpdate(ydoc);
        socket.emit('sync-complete', {
          state: Buffer.from(stateVector).toString('base64'),
          content: ydoc.getText('content').toString(),
          title: ydoc.getText('title').toString()
        });
        
        socket.to(documentId).emit('update', {
          update: Buffer.from(stateVector).toString('base64'),
          sender: 'server'
        });
        
        saveYDocState(documentId);
        
      } catch (error) {
        console.error('Error syncing offline changes:', error);
        socket.emit('error', { message: 'Failed to sync offline changes' });
      }
    });

    socket.on('get-history', async ({ documentId }) => {
      try {
        const doc = await Document.findById(documentId);
        if (doc && doc.changes) {
          socket.emit('history', { changes: doc.changes });
        }
      } catch (error) {
        console.error('Error getting history:', error);
      }
    });

    socket.on('set-permission', async ({ documentId, isPublic }) => {
      try {
        let doc = await Document.findById(documentId);
        if (!doc) {
          doc = new Document({ _id: documentId });
        }
        doc.isPublic = isPublic;
        await doc.save();
        io.to(documentId).emit('permission-changed', { isPublic });
      } catch (error) {
        console.error('Error setting permission:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      if (currentDocId) {
        const userKey = `doc:${currentDocId}:users`;
        await redisClient.hDel(userKey, socket.id);
        
        const onlineUsers = await getOnlineUsers(redisClient, currentDocId);
        io.to(currentDocId).emit('user-left', { users: onlineUsers });
        
        if (onlineUsers.length === 0 && documents.has(currentDocId)) {
          await saveYDocState(currentDocId);
          documents.delete(currentDocId);
          console.log('Document unloaded from memory:', currentDocId);
        }
      }
    });
  });
};

const docSaveTimeouts = new Map();

async function getOnlineUsers(redisClient, documentId) {
  const userKey = `doc:${documentId}:users`;
  const users = await redisClient.hGetAll(userKey);
  return Object.values(users).map(u => JSON.parse(u));
}
