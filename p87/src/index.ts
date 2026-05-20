import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDatabases, processDB, traceDB, qualityDB } from './config/databases';
import logger from './config/logger';
import rateLimiter from './middleware/rateLimiter';
import { securityHeaders, getSecurityInfo } from './middleware/security';

import authRoutes from './routes/authRoutes';
import craftRoutes from './routes/craftRoutes';
import materialRoutes from './routes/materialRoutes';
import productionRoutes from './routes/productionRoutes';
import qualityRoutes from './routes/qualityRoutes';
import batchRoutes from './routes/batchRoutes';
import thirdPartyRoutes from './routes/thirdPartyRoutes';
import alertRoutes from './routes/alertRoutes';
import exportRoutes from './routes/exportRoutes';
import originRoutes from './routes/originRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(securityHeaders);
app.use(cors());
app.use(rateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/crafts', craftRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/third-party', thirdPartyRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/origins', originRoutes);

app.get('/api/security/info', getSecurityInfo);

app.get('/health', async (req, res) => {
  try {
    const [processResult, traceResult, qualityResult] = await Promise.all([
      processDB.query('SELECT 1 as health'),
      traceDB.query('SELECT 1 as health'),
      qualityDB.query('SELECT 1 as health')
    ]);

    const databases = {
      process: processResult ? 'healthy' : 'unhealthy',
      trace: traceResult ? 'healthy' : 'unhealthy',
      quality: qualityResult ? 'healthy' : 'unhealthy'
    };

    const allHealthy = Object.values(databases).every(status => status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      message: allHealthy ? '漆器工艺溯源API服务运行正常' : '部分服务异常',
      timestamp: new Date().toISOString(),
      databases
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: '服务不可用',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = async () => {
  try {
    await connectDatabases();
    
    app.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

export default app;
