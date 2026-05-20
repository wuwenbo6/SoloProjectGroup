import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import logger from '../shared/middleware/logger';
import { signatureValidationMiddleware } from '../shared/middleware/requestSecurity';
import { errorHandler, notFoundHandler } from '../shared/middleware/errorHandler';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

app.use(limiter);

app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    logger.warn(`Request timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(504).json({ error: '请求超时，请稍后重试' });
    }
  });
  next();
});

const proxyOptions: Options = {
  timeout: 25000,
  proxyTimeout: 25000,
  changeOrigin: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    logger.error(`Proxy error for ${req.method} ${req.path}: ${err.message}`);
    if (!res.headersSent) {
      res.status(503).json({
        error: '服务暂时不可用，请稍后重试',
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setTimeout(25000);
  },
};

const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  materials: process.env.MATERIAL_SERVICE_URL || 'http://localhost:3002',
  collection: process.env.COLLECTION_SERVICE_URL || 'http://localhost:3003',
  inspection: process.env.INSPECTION_SERVICE_URL || 'http://localhost:3004',
  batches: process.env.BATCH_SERVICE_URL || 'http://localhost:3005',
  thirdParty: process.env.THIRD_PARTY_SERVICE_URL || 'http://localhost:3006',
};

app.use(
  '/api/auth',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.auth,
    pathRewrite: {
      '^/api/auth': '/api/auth',
    },
  })
);

app.use(
  '/api/materials',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.materials,
    pathRewrite: {
      '^/api/materials': '/api/materials',
    },
  })
);

app.use(
  '/api/collection',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.collection,
    pathRewrite: {
      '^/api/collection': '/api/collection',
    },
  })
);

app.use(
  '/api/inspection',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.inspection,
    pathRewrite: {
      '^/api/inspection': '/api/inspection',
    },
  })
);

app.use(
  '/api/batches',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.batches,
    pathRewrite: {
      '^/api/batches': '/api/batches',
    },
  })
);

app.use(
  '/api/third-party',
  createProxyMiddleware({
    ...proxyOptions,
    target: services.thirdParty,
    pathRewrite: {
      '^/api/third-party': '/api/third-party',
    },
  })
);

async function checkServiceHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'GET', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

app.get('/api/health', async (req, res) => {
  const healthChecks = await Promise.all([
    checkServiceHealth(`${services.auth}/api/auth/health`).catch(() => false),
    checkServiceHealth(`${services.materials}/api/materials/health`).catch(() => false),
    checkServiceHealth(`${services.collection}/api/collection/health`).catch(() => false),
    checkServiceHealth(`${services.inspection}/api/inspection/health`).catch(() => false),
    checkServiceHealth(`${services.batches}/api/batches/health`).catch(() => false),
    checkServiceHealth(`${services.thirdParty}/api/third-party/health`).catch(() => false),
  ]);

  const allHealthy = healthChecks.every((h) => h === true);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: Date.now(),
    services: {
      auth: { url: services.auth, healthy: healthChecks[0] },
      materials: { url: services.materials, healthy: healthChecks[1] },
      collection: { url: services.collection, healthy: healthChecks[2] },
      inspection: { url: services.inspection, healthy: healthChecks[3] },
      batches: { url: services.batches, healthy: healthChecks[4] },
      thirdParty: { url: services.thirdParty, healthy: healthChecks[5] },
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Health check available at: /api/health');
});
