const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10 * 1024 * 1024
});

const hosts = new Map();
const rooms = new Map();
const viewers = new Map();

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  socket.on('register-host', (data) => {
    const hostInfo = {
      id: socket.id,
      name: data.name || `主机-${socket.id.slice(0, 6)}`,
      os: data.os || 'unknown',
      ip: socket.handshake.address,
      registeredAt: Date.now(),
      viewerCount: 0,
      hasController: false
    };
    hosts.set(socket.id, hostInfo);
    rooms.set(socket.id, {
      hostId: socket.id,
      controller: null,
      viewers: new Set()
    });
    console.log('主机注册:', hostInfo.name);
    io.emit('host-list', Array.from(hosts.values()));
  });

  socket.on('get-hosts', () => {
    socket.emit('host-list', Array.from(hosts.values()));
  });

  socket.on('join-view', (hostId) => {
    if (!rooms.has(hostId)) return;
    const room = rooms.get(hostId);
    room.viewers.add(socket.id);
    viewers.set(socket.id, hostId);
    
    const host = hosts.get(hostId);
    if (host) {
      host.viewerCount = room.viewers.size;
      io.emit('host-list', Array.from(hosts.values()));
    }
    
    socket.join(`room-${hostId}`);
    socket.emit('view-joined', { hostId });
    console.log(`观众 ${socket.id} 加入房间 ${hostId}`);
  });

  socket.on('leave-view', (hostId) => {
    if (!rooms.has(hostId)) return;
    const room = rooms.get(hostId);
    room.viewers.delete(socket.id);
    viewers.delete(socket.id);
    
    const host = hosts.get(hostId);
    if (host) {
      host.viewerCount = room.viewers.size;
      io.emit('host-list', Array.from(hosts.values()));
    }
    
    socket.leave(`room-${hostId}`);
    console.log(`观众 ${socket.id} 离开房间 ${hostId}`);
  });

  socket.on('broadcast-frame', (data) => {
    const roomId = viewers.get(socket.id);
    if (roomId) {
      socket.to(`room-${roomId}`).emit('stream-frame', data);
    }
  });

  socket.on('request-control', (hostId) => {
    if (!rooms.has(hostId)) return;
    const room = rooms.get(hostId);
    if (!room.controller) {
      room.controller = socket.id;
      const host = hosts.get(hostId);
      if (host) {
        host.hasController = true;
        io.emit('host-list', Array.from(hosts.values()));
      }
      socket.emit('control-granted', { hostId });
    } else {
      socket.emit('control-denied', { reason: '已有控制者' });
    }
  });

  socket.on('release-control', (hostId) => {
    if (!rooms.has(hostId)) return;
    const room = rooms.get(hostId);
    if (room.controller === socket.id) {
      room.controller = null;
      const host = hosts.get(hostId);
      if (host) {
        host.hasController = false;
        io.emit('host-list', Array.from(hosts.values()));
      }
    }
  });

  socket.on('clipboard-data', (data) => {
    const { targetId, type, content } = data;
    if (hosts.has(targetId)) {
      io.to(targetId).emit('clipboard-data', {
        from: socket.id,
        type,
        content
      });
    }
  });

  socket.on('offer', (data) => {
    const { targetId, offer } = data;
    if (hosts.has(targetId)) {
      io.to(targetId).emit('offer', {
        from: socket.id,
        offer: offer
      });
    }
  });

  socket.on('answer', (data) => {
    const { targetId, answer } = data;
    io.to(targetId).emit('answer', {
      from: socket.id,
      answer: answer
    });
  });

  socket.on('ice-candidate', (data) => {
    const { targetId, candidate } = data;
    io.to(targetId).emit('ice-candidate', {
      from: socket.id,
      candidate: candidate
    });
  });

  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id);
    
    const viewingHost = viewers.get(socket.id);
    if (viewingHost && rooms.has(viewingHost)) {
      const room = rooms.get(viewingHost);
      room.viewers.delete(socket.id);
      const host = hosts.get(viewingHost);
      if (host) {
        host.viewerCount = room.viewers.size;
      }
      viewers.delete(socket.id);
    }

    if (hosts.has(socket.id)) {
      const host = hosts.get(socket.id);
      console.log('主机注销:', host.name);
      hosts.delete(socket.id);
      rooms.delete(socket.id);
    } else {
      rooms.forEach((room, hostId) => {
        if (room.controller === socket.id) {
          room.controller = null;
          const host = hosts.get(hostId);
          if (host) {
            host.hasController = false;
          }
        }
      });
    }
    
    io.emit('host-list', Array.from(hosts.values()));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`信令服务器运行在端口 ${PORT}`);
});
