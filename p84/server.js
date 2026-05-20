require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDatabases, checkConnectionHealth, isConnectionHealthy } = require('./config/databases');
const { getCacheStats } = require('./config/cache');
const { 
  securityHeaders,
  inputSanitization,
  enhancedRateLimit,
  signatureValidation,
  requestDecryption,
  responseEncryption,
  auditLog
} = require('./middleware/security');
const logger = require('./config/logger');

const authRoutes = require('./routes/authRoutes');
const processRoutes = require('./routes/processRoutes');
const productionRoutes = require('./routes/productionRoutes');
const batchRoutes = require('./routes/batchRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const thirdPartyRoutes = require('./routes/thirdPartyRoutes');
const alertRoutes = require('./routes/alertRoutes');
const progressRoutes = require('./routes/progressRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(securityHeaders);
app.use(inputSanitization);
app.use(enhancedRateLimit);
app.use(requestDecryption);
app.use(responseEncryption);
app.use(signatureValidation);
app.use(auditLog);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: '请求过于频繁，请稍后再试'
});
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/process', processRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/third-party', thirdPartyRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  const dbHealth = {
    processDB: checkConnectionHealth('工艺数据库'),
    productionDB: checkConnectionHealth('生产数据库'),
    qualityDB: checkConnectionHealth('品质数据库'),
    authDB: checkConnectionHealth('认证数据库')
  };

  const allHealthy = Object.values(dbHealth).every(
    h => h.status === 'healthy'
  );

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    message: allHealthy ? '戏曲道具分布式API服务运行正常' : '部分数据库连接异常',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    databases: dbHealth
  });
});

app.get('/api/stats/cache', (req, res) => {
  res.json({
    success: true,
    data: getCacheStats()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用戏曲道具分布式API服务',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      process: '/api/process',
      production: '/api/production',
      batches: '/api/batches',
      quality: '/api/quality',
      thirdParty: '/api/third-party',
      alerts: '/api/alerts',
      progress: '/api/progress',
      reports: '/api/reports',
      health: '/api/health',
      cacheStats: '/api/stats/cache'
    },
    features: [
      '数据库连接池优化',
      '多级缓存系统',
      '并发更新保护',
      '自动重试机制',
      '健康检查监控',
      '批量数据同步',
      '参数异常预警',
      '制作进度追踪',
      '工艺报表导出',
      '请求加密验证',
      '安全审计日志'
    ]
  });
});

app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

const startServer = async () => {
  try {
    await initDatabases();
    
    app.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功，运行在端口 ${PORT}`);
      logger.info(`📡 API文档: http://localhost:${PORT}/api`);
      logger.info(`💊 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
