const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

require('./database');
const mapRoutes = require('./routes/maps');
const annotationRoutes = require('./routes/annotations');
const layerRoutes = require('./routes/layers');
const permissionRoutes = require('./routes/permissions');
const nameRelationRoutes = require('./routes/nameRelations');
const exportRoutes = require('./routes/export');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.use('/api/maps', mapRoutes(upload, io));
app.use('/api/annotations', annotationRoutes(io));
app.use('/api/layers', layerRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/name-relations', nameRelationRoutes);
app.use('/api/export', exportRoutes);

const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('join-map', ({ mapId, userId, userName }) => {
    socket.join(mapId);
    
    const userColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    activeUsers.set(socket.id, { mapId, userId, userName, color: userColor });
    
    io.to(mapId).emit('user-joined', {
      id: socket.id,
      userId,
      userName,
      color: userColor
    });
    
    const usersInMap = Array.from(activeUsers.values())
      .filter(u => u.mapId === mapId)
      .map(u => ({ id: u.userId, name: u.userName, color: u.color }));
    io.to(mapId).emit('active-users', usersInMap);
  });

  socket.on('cursor-move', ({ mapId, x, y }) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(mapId).emit('cursor-update', {
        userId: user.userId,
        userName: user.userName,
        color: user.color,
        x,
        y
      });
    }
  });

  socket.on('annotation-created', (data) => {
    socket.to(data.mapId).emit('annotation-added', data);
  });

  socket.on('annotation-updated', (data) => {
    socket.to(data.mapId).emit('annotation-modified', data);
  });

  socket.on('annotation-deleted', (data) => {
    socket.to(data.mapId).emit('annotation-removed', data);
  });

  socket.on('control-point-added', (data) => {
    socket.to(data.mapId).emit('control-point-new', data);
  });

  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      io.to(user.mapId).emit('user-left', { userId: user.userId });
      activeUsers.delete(socket.id);
      
      const usersInMap = Array.from(activeUsers.values())
        .filter(u => u.mapId === user.mapId)
        .map(u => ({ id: u.userId, name: u.userName, color: u.color }));
      io.to(user.mapId).emit('active-users', usersInMap);
    }
    console.log('用户断开连接:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
