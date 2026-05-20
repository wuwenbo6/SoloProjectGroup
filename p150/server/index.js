const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const Document = require('./models/Document');
const Version = require('./models/Version');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

const docs = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomId = url.pathname.slice(1);
  
  console.log('Yjs client connected to room:', roomId);

  if (!docs.has(roomId)) {
    docs.set(roomId, new Set());
  }
  docs.get(roomId).add(ws);

  ws.on('message', (message) => {
    docs.get(roomId).forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    if (docs.has(roomId)) {
      docs.get(roomId).delete(ws);
      if (docs.get(roomId).size === 0) {
        docs.delete(roomId);
      }
    }
  });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  
  if (pathname.startsWith('/socket.io/')) {
    io.engine.handleUpgrade(request, socket, head);
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/3d-editor')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', async ({ roomId, userId }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(userId);

    let document = await Document.findOne({ roomId });
    if (!document) {
      document = new Document({ roomId, data: {} });
      await document.save();
    }

    const versions = await Version.find({ roomId }).sort({ createdAt: -1 }).limit(10);

    socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
    socket.emit('room-joined', {
      users: Array.from(rooms.get(roomId)),
      document: document.data,
      versions
    });

    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('signal', ({ to, from, signal }) => {
    io.to(to).emit('signal', { from, signal });
  });

  socket.on('save-document', async ({ roomId, data, userId }) => {
    const document = await Document.findOne({ roomId });
    if (document) {
      const version = new Version({
        roomId,
        data: document.data,
        userId,
        versionNumber: (await Version.countDocuments({ roomId })) + 1
      });
      await version.save();

      document.data = data;
      document.updatedAt = new Date();
      await document.save();

      io.to(roomId).emit('document-saved', { document, version });
    }
  });

  socket.on('rollback-version', async ({ roomId, versionId, userId }) => {
    const version = await Version.findById(versionId);
    if (version) {
      const document = await Document.findOne({ roomId });
      if (document) {
        const newVersion = new Version({
          roomId,
          data: document.data,
          userId,
          versionNumber: (await Version.countDocuments({ roomId })) + 1
        });
        await newVersion.save();

        document.data = version.data;
        document.updatedAt = new Date();
        await document.save();

        io.to(roomId).emit('document-rolled-back', { document, version });
      }
    }
  });

  socket.on('get-versions', async ({ roomId }) => {
    const versions = await Version.find({ roomId }).sort({ createdAt: -1 }).limit(20);
    socket.emit('versions-list', versions);
  });

  socket.on('leave-room', ({ roomId, userId }) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(userId);
      socket.to(roomId).emit('user-left', { userId });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    rooms.forEach((users, roomId) => {
      users.forEach(userId => {
        users.delete(userId);
        socket.to(roomId).emit('user-left', { userId });
      });
    });
  });
});

app.get('/api/documents/:roomId', async (req, res) => {
  try {
    const document = await Document.findOne({ roomId: req.params.roomId });
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/versions/:roomId', async (req, res) => {
  try {
    const versions = await Version.find({ roomId: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
