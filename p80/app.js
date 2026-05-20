require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { idempotencyMiddleware } = require('./middleware/idempotency');
const { requestEncryptionMiddleware, auditLogMiddleware, sensitiveDataMiddleware } = require('./middleware/requestEncryption');

const rareBookRoutes = require('./routes/rareBookRoutes');
const restorationProgressRoutes = require('./routes/restorationProgressRoutes');
const techniqueRoutes = require('./routes/techniqueRoutes');
const techniqueVersionRoutes = require('./routes/techniqueVersionRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const thirdPartyRoutes = require('./routes/thirdPartyRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const traceRoutes = require('./routes/traceRoutes');
const alertRoutes = require('./routes/alertRoutes');
const pdfExportRoutes = require('./routes/pdfExportRoutes');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      error: '请求过于频繁',
      message: '请稍后再试',
      retryAfter: 900
    });
  }
});

app.use(limiter);
app.use(idempotencyMiddleware);
app.use(sensitiveDataMiddleware);
app.use(requestEncryptionMiddleware({
  encryptResponse: true,
  verifySignature: false,
  sensitiveFields: ['password', 'secret', 'token', 'apiKey', 'cardNumber']
}));
app.use(auditLogMiddleware);

app.use('/api/rare-books', rareBookRoutes);
app.use('/api/restoration-progress', restorationProgressRoutes);
app.use('/api/techniques', techniqueRoutes);
app.use('/api/technique-versions', techniqueVersionRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/third-party', thirdPartyRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/trace', traceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/exports', pdfExportRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: require('./package.json').version
  });
});

app.get('/api/encryption/test', (req, res) => {
  const { encryption } = req;
  const nonce = encryption.generateNonce();
  const timestamp = Date.now();
  res.json({
    nonce,
    timestamp,
    supportedAlgorithms: ['aes-256-gcm', 'sha256', 'hmac-sha256'],
    requestHeaders: {
      'x-timestamp': 'Unix时间戳',
      'x-nonce': '随机字符串防重放',
      'x-signature': 'HMAC-SHA256签名',
      'x-encrypted-payload': '是否加密传输'
    }
  });
});

app.use((err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack });

  if (err.name === 'SequelizeOptimisticLockError') {
    return res.status(409).json({
      error: '版本冲突',
      message: '数据已被修改，请刷新后重试'
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: '唯一约束冲突',
      message: '数据已存在，请检查后重试'
    });
  }

  if (err.code === '429' || err.statusCode === 429) {
    return res.status(429).json({
      error: '请求过于频繁',
      message: '请稍后再试'
    });
  }

  if (err.statusCode === 409 || err.status === 409) {
    return res.status(409).json({
      error: '操作冲突',
      message: err.message || '当前操作与现有数据冲突，请重试'
    });
  }

  if (err.message?.includes('加密') || err.message?.includes('解密') || err.message?.includes('签名')) {
    return res.status(401).json({
      error: '安全验证失败',
      message: err.message
    });
  }

  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
