require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { connectAllDatabases } = require('./config/database');
const concurrentHandler = require('./middleware/concurrentHandler');
const encryption = require('./middleware/encryption');

const authRoutes = require('./routes/authRoutes');
const materialRoutes = require('./routes/materialRoutes');
const traceRoutes = require('./routes/traceRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const batchRoutes = require('./routes/batchRoutes');
const thirdPartyRoutes = require('./routes/thirdPartyRoutes');
const encryptionRoutes = require('./routes/encryptionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  hsts: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true
}));

app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400
}));

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json({
  limit: '10mb',
  strict: true,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 10000
}));

app.use(concurrentHandler.healthCheckMiddleware());
app.use(concurrentHandler.timeoutMiddleware(parseInt(process.env.REQUEST_TIMEOUT) || 30000));
app.use(concurrentHandler.concurrentRequestLimiter());
app.use(concurrentHandler.createSpeedLimiter(60000, 80, 300));
app.use(concurrentHandler.createRateLimiter(60000, 200));
app.use(encryption.cryptoRateLimiter);
app.use(encryption.requestDecrypt);
app.use(encryption.responseEncrypt);
app.use(encryption.signatureValidation);

app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '传统乐器材质溯源系统 API',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/health',
    healthDetailed: '/health/detailed'
  });
});

app.use('/api/auth', concurrentHandler.circuitBreaker('auth'), authRoutes);
app.use('/api/materials', concurrentHandler.circuitBreaker('materials'), materialRoutes);
app.use('/api/traces', concurrentHandler.circuitBreaker('traces'), traceRoutes);
app.use('/api/quality', concurrentHandler.circuitBreaker('quality'), qualityRoutes);
app.use('/api/batches', concurrentHandler.circuitBreaker('batches'), batchRoutes);
app.use('/api/third-party', concurrentHandler.circuitBreaker('third-party'), thirdPartyRoutes);
app.use('/api/encryption', concurrentHandler.circuitBreaker('encryption'), encryptionRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的 API 端点不存在',
    code: 'API_NOT_FOUND',
    path: req.path,
    method: req.method
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: '请求体格式错误',
      code: 'INVALID_JSON'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: '请求体过大',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    requestId: req.id,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const startServer = async () => {
  try {
    console.log('正在连接数据库...');
    await connectAllDatabases();
    console.log('数据库连接成功\n');

    const server = app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('  传统乐器材质溯源系统 API 服务已启动');
      console.log('='.repeat(60));
      console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  端口: ${PORT}`);
      console.log(`  地址: http://localhost:${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/health`);
      console.log(`  详细监控: http://localhost:${PORT}/health/detailed`);
      console.log(`  最大并发请求: ${process.env.MAX_CONCURRENT_REQUESTS || 100}`);
      console.log(`  请求队列大小: ${process.env.MAX_QUEUE_SIZE || 500}`);
      console.log(`  请求超时时间: ${process.env.REQUEST_TIMEOUT || 30000}ms`);
      console.log('='.repeat(60));
      console.log('');
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    concurrentHandler.gracefulShutdown(server, 30000);

    process.on('uncaughtException', (err) => {
      console.error('未捕获的异常:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的 Promise 拒绝:', {
        reason: reason?.message || reason,
        promise: promise?.toString()
      });
    });

  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
