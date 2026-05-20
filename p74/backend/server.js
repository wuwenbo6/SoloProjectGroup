const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('Accept-Ranges', 'bytes');
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.get('/api/videos/stream/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '视频不存在' });
  }
  
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=31536000'
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=31536000'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 10000
});

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const stitchRoutes = require('./routes/stitches');
const progressRoutes = require('./routes/progress');
const qaRoutes = require('./routes/qa');
const videoRoutes = require('./routes/videos');

app.use('/api/auth', authRoutes);
app.use('/api/stitches', stitchRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/videos', videoRoutes);

const onlineUsers = new Map();
const messageQueue = new Map();

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('join', (userId) => {
    onlineUsers.set(socket.id, { userId, connectedAt: Date.now() });
    io.emit('userOnline', Array.from(onlineUsers.values()).map(u => u.userId));
  });

  socket.on('sendMessage', (data) => {
    const messageId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const messageData = { ...data, id: messageId, timestamp: Date.now() };
    messageQueue.set(messageId, messageData);
    
    io.emit('newMessage', messageData);
    
    setTimeout(() => {
      messageQueue.delete(messageId);
    }, 300000);
  });

  socket.on('teacherAnswer', (data) => {
    const answerData = { ...data, timestamp: Date.now() };
    io.emit('newAnswer', answerData);
    
    io.emit('notification', {
      type: 'new_answer',
      questionId: data.questionId,
      title: '教师已回答您的问题',
      timestamp: Date.now()
    });
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('userTyping', data);
  });

  socket.on('messageAck', (messageId) => {
    messageQueue.delete(messageId);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('userOnline', Array.from(onlineUsers.values()).map(u => u.userId));
    console.log('用户断开连接:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

db.initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
});

module.exports = { io };
