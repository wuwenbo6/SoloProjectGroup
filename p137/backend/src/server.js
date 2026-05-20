const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const redis = require('redis');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

let redisClient;

async function initRedis() {
  try {
    redisClient = redis.createClient({
      url: 'redis://localhost:6379'
    });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (err) {
    console.log('Redis connection failed, using in-memory storage');
    redisClient = null;
  }
}

initRedis();

const rooms = new Map();

const userColors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4'
];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  const { roomId, userId, userName } = socket.handshake.query;
  
  if (!roomId || !userId || !userName) {
    socket.disconnect();
    return;
  }

  socket.join(roomId);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId);
  const colorIndex = room.size % userColors.length;
  const user = {
    userId,
    userName,
    socketId: socket.id,
    color: userColors[colorIndex],
    connectedAt: Date.now()
  };

  room.set(userId, user);

  const usersInRoom = Array.from(room.values()).map(u => ({
    userId: u.userId,
    userName: u.userName,
    color: u.color
  }));

  io.to(roomId).emit('users', usersInRoom);

  socket.to(roomId).emit('user-joined', {
    userId,
    userName,
    color: user.color
  });

  const existingUsers = usersInRoom.filter(u => u.userId !== userId);
  socket.emit('existing-users', existingUsers);

  saveRoomToRedis(roomId, usersInRoom);

  socket.on('offer', ({ to, offer }) => {
    const targetUser = room.get(to);
    if (targetUser) {
      io.to(targetUser.socketId).emit('offer', { from: userId, offer });
    }
  });

  socket.on('answer', ({ to, answer }) => {
    const targetUser = room.get(to);
    if (targetUser) {
      io.to(targetUser.socketId).emit('answer', { from: userId, answer });
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetUser = room.get(to);
    if (targetUser) {
      io.to(targetUser.socketId).emit('ice-candidate', { from: userId, candidate });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const room = rooms.get(roomId);
    if (room) {
      room.delete(userId);
      
      socket.to(roomId).emit('user-left', { userId });

      const remainingUsers = Array.from(room.values()).map(u => ({
        userId: u.userId,
        userName: u.userName,
        color: u.color
      }));

      io.to(roomId).emit('users', remainingUsers);

      saveRoomToRedis(roomId, remainingUsers);

      if (room.size === 0) {
        rooms.delete(roomId);
        if (redisClient) {
          redisClient.del(`room:${roomId}:users`);
        }
      }
    }

    socket.leave(roomId);
  });
});

async function saveRoomToRedis(roomId, users) {
  if (redisClient) {
    try {
      await redisClient.setEx(
        `room:${roomId}:users`,
        3600,
        JSON.stringify(users)
      );
    } catch (err) {
      console.error('Error saving to Redis:', err);
    }
  }
}

app.get('/api/room/:roomId/users', async (req, res) => {
  const { roomId } = req.params;
  
  if (redisClient) {
    try {
      const cachedUsers = await redisClient.get(`room:${roomId}:users`);
      if (cachedUsers) {
        return res.json({ users: JSON.parse(cachedUsers) });
      }
    } catch (err) {
      console.error('Error reading from Redis:', err);
    }
  }

  const room = rooms.get(roomId);
  const users = room ? Array.from(room.values()).map(u => ({
    userId: u.userId,
    userName: u.userName,
    color: u.color
  })) : [];

  res.json({ users });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([roomId, users]) => ({
    roomId,
    userCount: users.size
  }));
  res.json({ rooms: roomList });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
