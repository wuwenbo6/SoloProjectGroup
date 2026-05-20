const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectAllDBs, getDBStats } = require('./config/databases');

const authRoutes = require('./routes/authRoutes');
const craftRoutes = require('./routes/craftRoutes');
const productionRoutes = require('./routes/productionRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const batchRoutes = require('./routes/batchRoutes');
const thirdPartyRoutes = require('./routes/thirdPartyRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');
const progressRoutes = require('./routes/progressRoutes');

const { apiRateLimiter, authRateLimiter, batchRateLimiter } = require('./middleware/rateLimiter');
const { requestTimeout, mediumTimeout } = require('./middleware/timeout');
const { signatureVerification, responseEncryption, sanitizeInput, auditLog } = require('./middleware/signature');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

app.use(requestTimeout);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(sanitizeInput());
app.use(auditLog({ logSuccess: process.env.NODE_ENV === 'production' }));
app.use(responseEncryption());

const enableSignatureVerification = process.env.ENABLE_SIGNATURE_VERIFICATION === 'true';
if (enableSignatureVerification) {
  app.use(signatureVerification({
    skipPaths: ['/api/auth', '/api/health'],
    skipMethods: ['OPTIONS'],
  }));
}

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
  });
  
  next();
});

app.get('/api/health', (req, res) => {
  const dbStats = getDBStats();
  const dbStatus = Object.keys(dbStats).length > 0 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    success: true,
    message: 'Woodcarving API Service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    dbStats,
    memory: {
      usage: process.memoryUsage(),
    },
  });
});

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/crafts', apiRateLimiter, craftRoutes);
app.use('/api/production', apiRateLimiter, productionRoutes);
app.use('/api/quality', apiRateLimiter, qualityRoutes);
app.use('/api/batches', batchRateLimiter, batchRoutes);
app.use('/api/third-party', apiRateLimiter, thirdPartyRoutes);
app.use('/api/alerts', apiRateLimiter, alertRoutes);
app.use('/api/reports', apiRateLimiter, reportRoutes);
app.use('/api/progress', apiRateLimiter, progressRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: Object.values(err.errors).map(e => e.message),
    });
  }
  
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: '数据已存在',
      });
    }
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: '无效的ID格式',
    });
  }
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectAllDBs();
    
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.maxConnections = 1000;

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;