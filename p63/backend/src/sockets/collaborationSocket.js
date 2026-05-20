const activeSessions = new Map();
const userSocketMap = new Map();
const debounceTimers = new Map();
const pendingUpdates = new Map();

const DEBOUNCE_DELAY = 500;
const BATCH_THRESHOLD = 5;

const getSessionKey = (rubbingId) => `session_${rubbingId}`;
const getUpdateKey = (rubbingId, charId) => `${rubbingId}_${charId}`;

const processPendingUpdates = (io, updateKey) => {
  const updateData = pendingUpdates.get(updateKey);
  if (!updateData) return;

  const [rubbingId, charId] = updateKey.split('_');
  
  io.to(rubbingId).emit('batch-character-update', {
    characterId: charId,
    updates: updateData.updates,
    lastEditor: updateData.lastEditor,
    timestamp: new Date().toISOString()
  });

  pendingUpdates.delete(updateKey);
  if (debounceTimers.has(updateKey)) {
    clearTimeout(debounceTimers.get(updateKey));
    debounceTimers.delete(updateKey);
  }
};

const queueUpdate = (io, rubbingId, charId, update, userId, username) => {
  const updateKey = getUpdateKey(rubbingId, charId);
  
  if (!pendingUpdates.has(updateKey)) {
    pendingUpdates.set(updateKey, {
      updates: [],
      lastEditor: { userId, username }
    });
  }

  const updateData = pendingUpdates.get(updateKey);
  updateData.updates.push(update);
  updateData.lastEditor = { userId, username };

  if (debounceTimers.has(updateKey)) {
    clearTimeout(debounceTimers.get(updateKey));
  }

  if (updateData.updates.length >= BATCH_THRESHOLD) {
    processPendingUpdates(io, updateKey);
  } else {
    const timer = setTimeout(() => {
      processPendingUpdates(io, updateKey);
    }, DEBOUNCE_DELAY);
    debounceTimers.set(updateKey, timer);
  }
};

const broadcastProgressUpdate = (io, rubbingId) => {
  const sessionKey = getSessionKey(rubbingId);
  const session = activeSessions.get(sessionKey);
  if (session && session.progress !== undefined) {
    io.to(rubbingId).emit('progress-update', {
      progress: session.progress,
      timestamp: new Date().toISOString()
    });
  }
};

const calculateProgress = (characters) => {
  if (!characters || characters.length === 0) return 0;
  const confirmed = characters.filter(c => c.status === 'confirmed').length;
  return Math.round((confirmed / characters.length) * 100);
};

module.exports = (io, socket) => {
  socket.on('join-rubbing', async ({ rubbingId, userId, username }) => {
    socket.join(rubbingId);
    
    const sessionKey = getSessionKey(rubbingId);
    if (!activeSessions.has(sessionKey)) {
      activeSessions.set(sessionKey, {
        users: new Set(),
        cursors: new Map(),
        editingChars: new Set(),
        progress: 0,
        lastActivity: Date.now()
      });
    }

    const session = activeSessions.get(sessionKey);
    session.users.add(JSON.stringify({ userId, username }));
    session.lastActivity = Date.now();

    userSocketMap.set(socket.id, { userId, username, rubbingId });

    const activeUsersList = Array.from(session.users).map(u => JSON.parse(u));
    
    socket.to(rubbingId).emit('user-joined', {
      userId,
      username,
      activeUsers: activeUsersList,
      timestamp: new Date().toISOString()
    });

    socket.emit('session-init', {
      activeUsers: activeUsersList,
      cursors: Object.fromEntries(session.cursors),
      editingChars: Array.from(session.editingChars),
      progress: session.progress
    });

    console.log(`用户 ${username} 加入拓片 ${rubbingId} 的协作，当前在线: ${activeUsersList.length}人`);
  });

  socket.on('leave-rubbing', ({ rubbingId, userId, username }) => {
    socket.leave(rubbingId);
    
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      session.users.delete(JSON.stringify({ userId, username }));
      session.cursors.delete(userId);
      
      if (session.users.size === 0) {
        activeSessions.delete(sessionKey);
      } else {
        const activeUsersList = Array.from(session.users).map(u => JSON.parse(u));
        
        socket.to(rubbingId).emit('user-left', {
          userId,
          username,
          activeUsers: activeUsersList,
          timestamp: new Date().toISOString()
        });
      }
    }

    userSocketMap.delete(socket.id);

    console.log(`用户 ${username} 离开拓片 ${rubbingId} 的协作`);
  });

  socket.on('character-update', ({ rubbingId, characterId, data, userId, username }) => {
    queueUpdate(io, rubbingId, characterId, data, userId, username);

    socket.to(rubbingId).emit('activity-indicator', {
      userId,
      username,
      characterId,
      action: 'editing',
      timestamp: new Date().toISOString()
    });

    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    if (session) {
      session.lastActivity = Date.now();
    }
  });

  socket.on('confirm-update', ({ rubbingId, characterId, data, userId, username }) => {
    io.to(rubbingId).emit('character-confirmed', {
      characterId,
      data,
      userId,
      username,
      timestamp: new Date().toISOString()
    });

    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    if (session) {
      session.editingChars.delete(characterId);
    }
  });

  socket.on('bulk-update', ({ rubbingId, updates, userId, username }) => {
    io.to(rubbingId).emit('bulk-update-received', {
      updates,
      userId,
      username,
      timestamp: new Date().toISOString()
    });

    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    if (session) {
      session.lastActivity = Date.now();
    }

    console.log(`用户 ${username} 批量更新拓片 ${rubbingId} 的 ${updates.length} 个文字`);
  });

  socket.on('update-progress', ({ rubbingId, characters }) => {
    const progress = calculateProgress(characters);
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      session.progress = progress;
      broadcastProgressUpdate(io, rubbingId);
    }
  });

  socket.on('cursor-position', ({ rubbingId, userId, username, position }) => {
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      session.cursors.set(userId, { ...position, username });
      
      socket.to(rubbingId).emit('cursor-moved', {
        userId,
        username,
        position,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('start-editing', ({ rubbingId, characterId, userId, username }) => {
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      session.editingChars.add(characterId);
      
      io.to(rubbingId).emit('editing-started', {
        characterId,
        userId,
        username,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('stop-editing', ({ rubbingId, characterId, userId, username }) => {
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      session.editingChars.delete(characterId);
      
      io.to(rubbingId).emit('editing-stopped', {
        characterId,
        userId,
        username,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('add-comment', ({ rubbingId, characterId, comment, userId, username }) => {
    io.to(rubbingId).emit('comment-added', {
      characterId,
      comment,
      userId,
      username,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('request-sync', ({ rubbingId, userId }) => {
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    
    if (session) {
      socket.emit('sync-response', {
        cursors: Object.fromEntries(session.cursors),
        editingChars: Array.from(session.editingChars),
        progress: session.progress,
        activeUsers: Array.from(session.users).map(u => JSON.parse(u))
      });
    }
  });

  socket.on('disconnect', () => {
    const user = userSocketMap.get(socket.id);
    if (user) {
      const { rubbingId, userId, username } = user;
      const sessionKey = getSessionKey(rubbingId);
      const session = activeSessions.get(sessionKey);
      
      if (session) {
        session.users.delete(JSON.stringify({ userId, username }));
        session.cursors.delete(userId);
        
        if (session.users.size === 0) {
          activeSessions.delete(sessionKey);
        } else {
          const activeUsersList = Array.from(session.users).map(u => JSON.parse(u));
          
          io.to(rubbingId).emit('user-left', {
            userId,
            username,
            activeUsers: activeUsersList,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      userSocketMap.delete(socket.id);
      console.log(`用户 ${username} 断开连接`);
    }
  });

  socket.on('heartbeat', ({ rubbingId }) => {
    const sessionKey = getSessionKey(rubbingId);
    const session = activeSessions.get(sessionKey);
    if (session) {
      session.lastActivity = Date.now();
    }
  });
};

setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000;
  
  for (const [sessionKey, session] of activeSessions) {
    if (now - session.lastActivity > TIMEOUT) {
      activeSessions.delete(sessionKey);
      console.log(`清理超时会话: ${sessionKey}`);
    }
  }
}, 60 * 1000);

module.exports.getActiveSessions = () => {
  const sessions = [];
  for (const [key, session] of activeSessions) {
    sessions.push({
      rubbingId: key.replace('session_', ''),
      userCount: session.users.size,
      progress: session.progress,
      lastActivity: session.lastActivity
    });
  }
  return sessions;
};
