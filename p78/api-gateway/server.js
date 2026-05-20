require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const httpProxy = require('express-http-proxy');
const http = require('http');
const https = require('https');
const { requestEncryptionMiddleware, responseEncryptionMiddleware } = require('../shared/middleware/encryption');
const { addSecurityHeaders, sanitizeObject, auditLog, rateLimit } = require('../shared/utils/security');

http.globalAgent.maxSockets = 100;
https.globalAgent.maxSockets = 100;

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

const SERVICE_URLS = {
  auth: `http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}`,
  material: `http://localhost:${process.env.MATERIAL_SERVICE_PORT || 3002}`,
  trace: `http://localhost:${process.env.TRACE_SERVICE_PORT || 3003}`,
  quality: `http://localhost:${process.env.QUALITY_SERVICE_PORT || 3004}`,
  batch: `http://localhost:${process.env.BATCH_SERVICE_PORT || 3005}`,
  thirdparty: `http://localhost:${process.env.THIRDPARTY_SERVICE_PORT || 3006}`
};

const circuitBreakers = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000;

class CircuitBreaker {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = null;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`[${this.serviceName}] Circuit breaker closed - service recovered`);
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'CLOSED' && this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.state = 'OPEN';
      console.log(`[${this.serviceName}] Circuit breaker opened after ${this.failureCount} failures`);
      setTimeout(() => {
        this.state = 'HALF_OPEN';
        console.log(`[${this.serviceName}] Circuit breaker half-open - allowing test requests`);
      }, CIRCUIT_BREAKER_RESET_TIMEOUT);
    }
  }

  canRequest() {
    if (this.state === 'OPEN') return false;
    if (this.state === 'HALF_OPEN') return true;
    return true;
  }
}

Object.keys(SERVICE_URLS).forEach(serviceName => {
  circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
});

const rateLimit = (() => {
  const requests = new Map();
  const MAX_REQUESTS_PER_WINDOW = 100;
  const WINDOW_MS = 60000;

  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const windowStart = now - WINDOW_MS;
    const recentRequests = requests.get(key).filter(time => time > windowStart);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后重试',
        retry_after: Math.ceil(WINDOW_MS / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    next();
  };
})();

app.use(addSecurityHeaders);

app.use(helmet({
  hsts: { maxAge: 31536000 },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  maxAge: 86400,
  preflightContinue: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-encrypted', 'x-timestamp', 'x-nonce', 'x-signature', 'x-encrypt-response']
}));

app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '请求过于频繁，请稍后再试'
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
});

app.use(requestEncryptionMiddleware);
app.use(responseEncryptionMiddleware);

app.use((req, res, next) => {
  const sensitivePaths = ['/api/auth', '/api/batches', '/api/quality'];
  if (sensitivePaths.some(path => req.path.startsWith(path))) {
    auditLog(req.method + ' ' + req.path, { id: req.user?.id, username: req.user?.username }, req.path, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  next();
});

const serviceAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

const createProxy = (serviceUrl, serviceName) => {
  return httpProxy(serviceUrl, {
    proxyReqPathResolver: (req) => {
      return req.originalUrl;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.agent = serviceAgent;
      proxyReqOpts.timeout = 10000;
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      const cb = circuitBreakers.get(serviceName);
      if (cb && proxyRes.statusCode < 500) {
        cb.recordSuccess();
      }
      return proxyResData;
    },
    proxyErrorHandler: (err, res, next) => {
      const cb = circuitBreakers.get(serviceName);
      if (cb) {
        cb.recordFailure();
      }
      
      console.error(`[${serviceName}] Proxy error:`, err.message);
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        return res.status(503).json({
          success: false,
          message: `${serviceName}服务暂时不可用，请稍后重试`,
          error_code: err.code,
          timestamp: new Date().toISOString()
        });
      }
      
      if (err.code === 'ETIMEDOUT') {
        return res.status(504).json({
          success: false,
          message: '服务响应超时，请稍后重试',
          error_code: err.code,
          timestamp: new Date().toISOString()
        });
      }
      
      res.status(503).json({
        success: false,
        message: '服务暂时不可用，请稍后重试',
        error_code: err.code,
        timestamp: new Date().toISOString()
      });
    }
  });
};

const circuitBreakerMiddleware = (serviceName) => {
  return (req, res, next) => {
    const cb = circuitBreakers.get(serviceName);
    if (cb && !cb.canRequest()) {
      return res.status(503).json({
        success: false,
        message: `${serviceName}服务断路器已开启，请稍后重试`,
        retry_after: Math.ceil(CIRCUIT_BREAKER_RESET_TIMEOUT / 1000),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

app.use('/api/auth', circuitBreakerMiddleware('auth'), createProxy(SERVICE_URLS.auth, 'auth'));
app.use('/api/materials', circuitBreakerMiddleware('material'), createProxy(SERVICE_URLS.material, 'material'));
app.use('/api/trace', circuitBreakerMiddleware('trace'), createProxy(SERVICE_URLS.trace, 'trace'));
app.use('/api/quality', circuitBreakerMiddleware('quality'), createProxy(SERVICE_URLS.quality, 'quality'));
app.use('/api/batches', circuitBreakerMiddleware('batch'), createProxy(SERVICE_URLS.batch, 'batch'));
app.use('/api/thirdparty', circuitBreakerMiddleware('thirdparty'), createProxy(SERVICE_URLS.thirdparty, 'thirdparty'));

app.get('/api/health', async (req, res) => {
  const services = [
    { name: 'Auth Service', url: `${SERVICE_URLS.auth}/api/auth/health`, key: 'auth' },
    { name: 'Material Service', url: `${SERVICE_URLS.material}/api/materials/health`, key: 'material' },
    { name: 'Trace Service', url: `${SERVICE_URLS.trace}/api/trace/health`, key: 'trace' },
    { name: 'Quality Service', url: `${SERVICE_URLS.quality}/api/quality/health`, key: 'quality' },
    { name: 'Batch Service', url: `${SERVICE_URLS.batch}/api/batches/health`, key: 'batch' },
    { name: 'Third-party Service', url: `${SERVICE_URLS.thirdparty}/api/thirdparty/health`, key: 'thirdparty' }
  ];

  const healthResults = [];
  let allHealthy = true;
  const axios = require('axios');

  const healthCheckPromises = services.map(async (service) => {
    const cb = circuitBreakers.get(service.key);
    const cbStatus = cb ? cb.state : 'UNKNOWN';
    
    try {
      const response = await axios.get(service.url, { timeout: 2000 });
      return {
        name: service.name,
        status: 'UP',
        circuit_breaker: cbStatus,
        timestamp: response.data.timestamp
      };
    } catch (err) {
      allHealthy = false;
      return {
        name: service.name,
        status: 'DOWN',
        circuit_breaker: cbStatus,
        error: err.code || err.message
      };
    }
  });

  const results = await Promise.allSettled(healthCheckPromises);
  
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      healthResults.push(result.value);
    }
  });

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    gateway: 'API Gateway is running',
    services: healthResults,
    concurrency_control: {
      max_sockets: http.globalAgent.maxSockets,
      rate_limit_per_minute: 100
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '古法酿造原料溯源系统 - API Gateway',
    version: '1.0.0',
    description: '分布式微服务架构的原料溯源API网关',
    features: ['Circuit Breaker', 'Connection Pooling', 'Rate Limiting', 'Keep-Alive'],
    endpoints: {
      auth: '/api/auth',
      materials: '/api/materials',
      trace: '/api/trace',
      quality: '/api/quality',
      batches: '/api/batches',
      thirdparty: '/api/thirdparty',
      health: '/api/health'
    },
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('Gateway error:', err.stack);
  res.status(500).json({
    success: false,
    message: '网关内部错误',
    error_type: err.name,
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`API Gateway 运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
  console.log('高可用配置:');
  console.log(`  - 连接池最大连接数: ${http.globalAgent.maxSockets}`);
  console.log(`  - 熔断阈值: ${CIRCUIT_BREAKER_THRESHOLD}次失败`);
  console.log(`  - 熔断重置时间: ${CIRCUIT_BREAKER_RESET_TIMEOUT / 1000}秒`);
  console.log(`  - 限流: 每分钟${100}次请求/IP`);
  console.log(`  - Keep-Alive: 已启用 (30秒)`);
  console.log(`\n服务端口映射:`);
  Object.entries(SERVICE_URLS).forEach(([name, url]) => {
    console.log(`  ${name.padEnd(15)} -> ${url}`);
  });
  console.log('');
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxHeadersCount = 1000;

module.exports = app;
