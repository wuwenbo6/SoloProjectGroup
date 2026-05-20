const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const patternRoutes = require('./routes/patterns');
const userRoutes = require('./routes/users');
const Pattern = require('./models/Pattern');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect('mongodb://localhost:27017/face-pattern-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB 连接成功'))
.catch(err => console.log('MongoDB 连接失败:', err));

app.set('io', io);

app.use('/api/patterns', patternRoutes);
app.use('/api/users', userRoutes);

const activeEditors = new Map();
const editorInfo = new Map();
const pendingOps = new Map();

function acquireEditLock(patternId, userId, userName) {
  const now = new Date();
  const lockKey = `lock:${patternId}`;
  
  let lock = pendingOps.get(lockKey);
  if (lock && lock.expiresAt > now) {
    return { success: false, lock };
  }
  
  lock = {
    userId,
    userName,
    acquiredAt: now,
    expiresAt: new Date(now.getTime() + 30000)
  };
  pendingOps.set(lockKey, lock);
  
  setTimeout(() => {
    const currentLock = pendingOps.get(lockKey);
    if (currentLock && currentLock.userId === userId) {
      releaseEditLock(patternId, userId);
    }
  }, 30000);
  
  return { success: true, lock };
}

function releaseEditLock(patternId, userId) {
  const lockKey = `lock:${patternId}`;
  const lock = pendingOps.get(lockKey);
  if (lock && lock.userId === userId) {
    pendingOps.delete(lockKey);
    return true;
  }
  return false;
}

async function applyDeltaUpdate(patternId, delta, baseVersion, userId, userName) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const pattern = await Pattern.findById(patternId).session(session);
    if (!pattern) {
      await session.abortTransaction();
      return { success: false, error: '纹样不存在' };
    }
    
    if (pattern.outlineVersion !== baseVersion) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: '版本冲突',
        currentVersion: pattern.outlineVersion,
        shouldRefresh: true
      };
    }
    
    if (delta.outlineData !== undefined) {
      pattern.outlineData = delta.outlineData;
    }
    if (delta.name !== undefined) {
      pattern.name = delta.name;
    }
    if (delta.description !== undefined) {
      pattern.description = delta.description;
    }
    if (delta.category !== undefined) {
      pattern.category = delta.category;
    }
    if (delta.tags !== undefined) {
      pattern.tags = delta.tags;
    }
    if (delta.colors !== undefined) {
      pattern.colors = delta.colors;
    }
    
    pattern.outlineVersion = baseVersion + 1;
    pattern.lastEditedBy = userId;
    pattern.lastEditedAt = new Date();
    
    await pattern.save({ session });
    await session.commitTransaction();
    
    return { 
      success: true, 
      newVersion: pattern.outlineVersion,
      pattern: pattern.toObject()
    };
  } catch (error) {
    await session.abortTransaction();
    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
}

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  let currentPatternId = null;
  let userId = socket.handshake.query.userId || 'anonymous';
  let userName = socket.handshake.query.userName || '匿名用户';

  socket.on('join-pattern', async (data) => {
    const { patternId } = data;
    currentPatternId = patternId;
    socket.join(`pattern-${patternId}`);
    
    if (!activeEditors.has(patternId)) {
      activeEditors.set(patternId, new Set());
    }
    activeEditors.get(patternId).add(socket.id);
    editorInfo.set(socket.id, { userId, userName, patternId });
    
    const editors = Array.from(activeEditors.get(patternId))
      .map(id => editorInfo.get(id))
      .filter(Boolean);
    
    io.to(`pattern-${patternId}`).emit('editor-count', {
      count: activeEditors.get(patternId).size,
      editors
    });
    
    try {
      const pattern = await Pattern.findById(patternId);
      if (pattern && pattern.editLock && pattern.editLock.expiresAt > new Date()) {
        socket.emit('edit-locked', {
          lockedBy: pattern.editLock.userName,
          expiresAt: pattern.editLock.expiresAt
        });
      }
    } catch (err) {
      console.error('检查编辑锁失败:', err);
    }
  });

  socket.on('leave-pattern', (patternId) => {
    socket.leave(`pattern-${patternId}`);
    if (activeEditors.has(patternId)) {
      activeEditors.get(patternId).delete(socket.id);
      const editors = Array.from(activeEditors.get(patternId))
        .map(id => editorInfo.get(id))
        .filter(Boolean);
      
      io.to(`pattern-${patternId}`).emit('editor-count', {
        count: activeEditors.get(patternId).size,
        editors
      });
    }
    editorInfo.delete(socket.id);
    if (currentPatternId === patternId) {
      currentPatternId = null;
    }
  });

  socket.on('acquire-lock', async ({ patternId, userId, userName }) => {
    const lock = acquireEditLock(patternId, userId, userName);
    if (lock.success) {
      socket.emit('lock-acquired', { patternId });
      socket.to(`pattern-${patternId}`).emit('lock-status', {
        locked: true,
        lockedBy: userName,
        expiresAt: lock.lock.expiresAt
      });
    } else {
      socket.emit('lock-failed', {
        lockedBy: lock.lock.userName,
        expiresAt: lock.lock.expiresAt
      });
    }
  });

  socket.on('release-lock', ({ patternId, userId }) => {
    if (releaseEditLock(patternId, userId)) {
      io.to(`pattern-${patternId}`).emit('lock-status', {
        locked: false
      });
    }
  });

  socket.on('drawing', (data) => {
    socket.to(`pattern-${data.patternId}`).emit('drawing', {
      ...data,
      drawerId: userId,
      drawerName: userName,
      timestamp: Date.now()
    });
  });

  socket.on('drawing-batch', (data) => {
    socket.to(`pattern-${data.patternId}`).emit('drawing-batch', {
      ...data,
      drawerId: userId,
      drawerName: userName,
      timestamp: Date.now()
    });
  });

  socket.on('update-pattern', async (data) => {
    const { patternId, delta, baseVersion, userId, userName } = data;
    
    const result = await applyDeltaUpdate(
      patternId, 
      delta, 
      baseVersion || 0, 
      userId, 
      userName
    );
    
    if (result.success) {
      io.to(`pattern-${patternId}`).emit('pattern-updated', {
        pattern: result.pattern,
        newVersion: result.newVersion,
        updatedBy: userName
      });
      socket.emit('update-confirmed', {
        patternId,
        newVersion: result.newVersion
      });
    } else {
      socket.emit('update-conflict', {
        patternId,
        error: result.error,
        shouldRefresh: result.shouldRefresh,
        currentVersion: result.currentVersion
      });
    }
  });

  socket.on('cursor-position', (data) => {
    socket.to(`pattern-${data.patternId}`).emit('cursor-moved', {
      ...data,
      userId,
      userName
    });
  });

  socket.on('save-outline', async (data) => {
    const { patternId, outlineData, baseVersion } = data;
    
    const result = await applyDeltaUpdate(
      patternId,
      { outlineData },
      baseVersion,
      userId,
      userName
    );
    
    if (result.success) {
      socket.emit('outline-saved', {
        patternId,
        newVersion: result.newVersion
      });
      socket.to(`pattern-${patternId}`).emit('outline-updated', {
        outlineData,
        newVersion: result.newVersion,
        updatedBy: userName
      });
    } else {
      socket.emit('outline-conflict', {
        error: result.error,
        currentVersion: result.currentVersion
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    
    if (currentPatternId && activeEditors.has(currentPatternId)) {
      activeEditors.get(currentPatternId).delete(socket.id);
      const editors = Array.from(activeEditors.get(currentPatternId))
        .map(id => editorInfo.get(id))
        .filter(Boolean);
      
      io.to(`pattern-${currentPatternId}`).emit('editor-count', {
        count: activeEditors.get(currentPatternId).size,
        editors
      });
    }
    
    editorInfo.delete(socket.id);
  });
});

setInterval(() => {
  const now = new Date();
  pendingOps.forEach((lock, key) => {
    if (lock.expiresAt <= now) {
      pendingOps.delete(key);
      const patternId = key.replace('lock:', '');
      io.to(`pattern-${patternId}`).emit('lock-status', { locked: false });
    }
  });
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

app.io = io;
