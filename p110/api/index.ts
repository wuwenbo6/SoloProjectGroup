import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import imageRoutes from './routes/images';
import versionRoutes from './routes/versions';
import variantRoutes from './routes/variants';
import annotationRoutes from './routes/annotations';
import syncRoutes from './routes/sync';
import { CollaborativeCursor } from '../shared/types';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  },
});

const activeUsers = new Map<string, { userId: string; username: string; imageId: string }>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-image', ({ imageId, userId, username }: { imageId: string; userId: string; username: string }) => {
    socket.join(imageId);
    activeUsers.set(socket.id, { userId, username, imageId });

    const usersInImage = Array.from(activeUsers.values())
      .filter(u => u.imageId === imageId);

    io.to(imageId).emit('active-users', usersInImage);
    console.log(`User ${username} joined image ${imageId}`);
  });

  socket.on('cursor-move', (cursor: CollaborativeCursor) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(user.imageId).emit('cursor-update', cursor);
    }
  });

  socket.on('block-update', (update: any) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(user.imageId).emit('block-updated', update);
    }
  });

  socket.on('leave-image', ({ imageId }: { imageId: string }) => {
    socket.leave(imageId);
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      const remainingUsers = Array.from(activeUsers.values())
        .filter(u => u.imageId === imageId);
      io.to(imageId).emit('active-users', remainingUsers);
    }
  });

  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { imageId } = user;
      activeUsers.delete(socket.id);
      const remainingUsers = Array.from(activeUsers.values())
        .filter(u => u.imageId === imageId);
      io.to(imageId).emit('active-users', remainingUsers);
    }
    console.log('User disconnected:', socket.id);
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket server running on ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
