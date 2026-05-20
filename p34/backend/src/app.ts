import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import { SocketService } from './services/SocketService';
import logger from './utils/logger';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import materialRoutes from './routes/material.routes';
import featureRoutes from './routes/feature.routes';
import patternRoutes from './routes/pattern.routes';
import categoryRoutes from './routes/category.routes';
import imageProcessingRoutes from './routes/imageProcessing.routes';
import museumRoutes from './routes/museum.routes';
import copyrightRoutes from './routes/copyright.routes';
import taskRoutes from './routes/task.routes';
import storageRoutes from './routes/storage.routes';

const app = express();
const httpServer = createServer(app);
const socketService = new SocketService(httpServer);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

const uploadsDir = path.join(config.uploads.path);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const materialsDir = path.join(uploadsDir, 'materials');
const patternsDir = path.join(uploadsDir, 'patterns');
if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir, { recursive: true });
if (!fs.existsSync(patternsDir)) fs.mkdirSync(patternsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketSessions: socketService.getAllSessions().length,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/image', imageProcessingRoutes);
app.use('/api/museum', museumRoutes);
app.use('/api/copyright', copyrightRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/storage', storageRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '路由不存在',
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

const PORT = config.port || 3000;

httpServer.listen(PORT, () => {
  logger.info(`
  ==========================================
  🚀 纹样数字化平台 - 后端服务启动成功
  ==========================================
  
  📍 服务地址: http://localhost:${PORT}
  📡 WebSocket: http://localhost:${PORT}
  📁 上传目录: ${uploadsDir}
  🛡️  环境: ${config.nodeEnv}
  
  API 路由:
  - 认证: /api/auth
  - 用户: /api/users
  - 素材: /api/materials
  - 特征: /api/features
  - 图案: /api/patterns
  - 分类: /api/categories
  - 馆藏同步: /api/museum
  - 版权登记: /api/copyright
  - 任务管理: /api/tasks
  
  健康检查: /health
  `);
});

process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    process.exit(0);
  });
});

export { httpServer, app, socketService };
