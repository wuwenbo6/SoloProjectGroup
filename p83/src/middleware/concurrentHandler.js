const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

class ConcurrentHandler {
  constructor() {
    this.activeRequests = 0;
    this.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100;
    this.queue = [];
    this.maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE) || 500;
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
    this.circuitBreakerState = {};
    this.healthMetrics = {
      totalRequests: 0,
      rejectedRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
  }

  createRateLimiter(windowMs = 60000, maxRequests = 100) {
    return rateLimit({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      },
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      handler: (req, res) => {
        this.healthMetrics.rejectedRequests++;
        res.status(429).json({
          success: false,
          message: '请求过于频繁，请稍后再试',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
    });
  }

  createSpeedLimiter(windowMs = 60000, delayAfter = 50, delayMs = 500) {
    return slowDown({
      windowMs,
      delayAfter,
      delayMs,
      headers: true
    });
  }

  concurrentRequestLimiter() {
    return (req, res, next) => {
      this.healthMetrics.totalRequests++;

      if (this.activeRequests >= this.maxConcurrentRequests) {
        if (this.queue.length >= this.maxQueueSize) {
          this.healthMetrics.rejectedRequests++;
          return res.status(503).json({
            success: false,
            message: '服务器繁忙，请稍后再试',
            code: 'SERVICE_UNAVAILABLE',
            retryAfter: 5
          });
        }

        const timeoutId = setTimeout(() => {
          const index = this.queue.findIndex(item => item.id === req.id);
          if (index !== -1) {
            this.queue.splice(index, 1);
            this.healthMetrics.rejectedRequests++;
            res.status(408).json({
              success: false,
              message: '请求超时',
              code: 'REQUEST_TIMEOUT'
            });
          }
        }, this.requestTimeout);

        this.queue.push({
          id: req.id || Date.now(),
          req,
          res,
          next,
          timeoutId,
          timestamp: Date.now()
        });
      } else {
        this.activeRequests++;
        const startTime = Date.now();

        const originalEnd = res.end;
        res.end = (...args) => {
          this.activeRequests--;
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode < 400) {
            this.healthMetrics.successfulRequests++;
          } else {
            this.healthMetrics.failedRequests++;
          }

          this.healthMetrics.responseTimes.push(responseTime);
          if (this.healthMetrics.responseTimes.length > 1000) {
            this.healthMetrics.responseTimes.shift();
          }

          this.processQueue();

          originalEnd.apply(res, args);
        };

        next();
      }
    };
  }

  processQueue() {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const queuedRequest = this.queue.shift();
      if (queuedRequest && !queuedRequest.res.headersSent) {
        clearTimeout(queuedRequest.timeoutId);
        this.activeRequests++;

        const startTime = Date.now();
        const originalEnd = queuedRequest.res.end;
        
        queuedRequest.res.end = (...args) => {
          this.activeRequests--;
          const responseTime = Date.now() - startTime;

          if (queuedRequest.res.statusCode < 400) {
            this.healthMetrics.successfulRequests++;
          } else {
            this.healthMetrics.failedRequests++;
          }

          this.healthMetrics.responseTimes.push(responseTime);
          if (this.healthMetrics.responseTimes.length > 1000) {
            this.healthMetrics.responseTimes.shift();
          }

          this.processQueue();
          originalEnd.apply(queuedRequest.res, args);
        };

        queuedRequest.next();
      }
    }
  }

  circuitBreaker(serviceName, options = {}) {
    const config = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 30000,
      resetTimeout: options.resetTimeout || 60000
    };

    if (!this.circuitBreakerState[serviceName]) {
      this.circuitBreakerState[serviceName] = {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
    }

    return (req, res, next) => {
      const state = this.circuitBreakerState[serviceName];
      const now = Date.now();

      if (state.state === 'OPEN') {
        if (now >= state.nextAttemptTime) {
          state.state = 'HALF-OPEN';
        } else {
          return res.status(503).json({
            success: false,
            message: '服务暂时不可用',
            code: 'CIRCUIT_OPEN',
            retryAfter: Math.ceil((state.nextAttemptTime - now) / 1000)
          });
        }
      }

      const originalEnd = res.end;
      res.end = (...args) => {
        if (res.statusCode >= 500) {
          state.failures++;
          state.lastFailureTime = now;
          
          if (state.state === 'HALF-OPEN') {
            state.state = 'OPEN';
            state.nextAttemptTime = now + config.resetTimeout;
          } else if (state.failures >= config.failureThreshold) {
            state.state = 'OPEN';
            state.nextAttemptTime = now + config.resetTimeout;
          }
        } else if (res.statusCode < 400) {
          if (state.state === 'HALF-OPEN') {
            state.successes++;
            if (state.successes >= config.successThreshold) {
              state.state = 'CLOSED';
              state.failures = 0;
              state.successes = 0;
            }
          } else if (state.state === 'CLOSED') {
            state.failures = Math.max(0, state.failures - 0.1);
          }
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  timeoutMiddleware(timeoutMs = 30000) {
    return (req, res, next) => {
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            message: '请求处理超时',
            code: 'REQUEST_TIMEOUT'
          });
        }
      }, timeoutMs);

      res.on('finish', () => {
        clearTimeout(timeoutId);
      });

      next();
    };
  }

  healthCheckMiddleware() {
    return (req, res, next) => {
      if (req.path === '/health' || req.path === '/health/detailed') {
        const now = Date.now();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const avgResponseTime = this.healthMetrics.responseTimes.length > 0
          ? this.healthMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.healthMetrics.responseTimes.length
          : 0;

        const healthStatus = {
          success: true,
          timestamp: new Date().toISOString(),
          uptime,
          server: {
            memory: {
              rss: Math.round(memoryUsage.rss / 1024 / 1024),
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              external: Math.round(memoryUsage.external / 1024 / 1024)
            },
            cpu: {
              user: cpuUsage.user,
              system: cpuUsage.system
            }
          },
          concurrency: {
            activeRequests: this.activeRequests,
            queuedRequests: this.queue.length,
            maxConcurrentRequests: this.maxConcurrentRequests,
            maxQueueSize: this.maxQueueSize
          },
          metrics: {
            totalRequests: this.healthMetrics.totalRequests,
            successfulRequests: this.healthMetrics.successfulRequests,
            failedRequests: this.healthMetrics.failedRequests,
            rejectedRequests: this.healthMetrics.rejectedRequests,
            avgResponseTime: Math.round(avgResponseTime)
          },
          circuitBreakers: Object.entries(this.circuitBreakerState).map(([name, state]) => ({
            service: name,
            state: state.state,
            failures: state.failures,
            nextAttemptTime: state.nextAttemptTime ? new Date(state.nextAttemptTime).toISOString() : null
          }))
        };

        const isHealthy = this.activeRequests < this.maxConcurrentRequests * 0.9 &&
          this.healthMetrics.failedRequests / Math.max(this.healthMetrics.totalRequests, 1) < 0.1;

        if (req.path === '/health/detailed') {
          return res.status(isHealthy ? 200 : 503).json(healthStatus);
        }

        return res.status(isHealthy ? 200 : 503).json({
          success: true,
          message: isHealthy ? '服务正常运行' : '服务负载较高',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      }
      next();
    };
  }

  gracefulShutdown(server, timeoutMs = 30000) {
    process.on('SIGTERM', () => this.initiateShutdown(server, timeoutMs, 'SIGTERM'));
    process.on('SIGINT', () => this.initiateShutdown(server, timeoutMs, 'SIGINT'));
  }

  initiateShutdown(server, timeoutMs, signal) {
    console.log(`\n收到 ${signal} 信号，开始优雅关闭...`);
    console.log(`当前活跃请求: ${this.activeRequests}，队列请求: ${this.queue.length}`);

    const shutdownTimeout = setTimeout(() => {
      console.error('强制关闭超时，退出进程');
      process.exit(1);
    }, timeoutMs);

    server.close(() => {
      clearTimeout(shutdownTimeout);
      console.log('服务器已关闭，所有请求处理完成');
      process.exit(0);
    });

    setTimeout(() => {
      if (this.activeRequests === 0 && this.queue.length === 0) {
        clearTimeout(shutdownTimeout);
        console.log('所有请求已处理完成');
        process.exit(0);
      }
    }, 1000);
  }

  getMetrics() {
    const avgResponseTime = this.healthMetrics.responseTimes.length > 0
      ? this.healthMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.healthMetrics.responseTimes.length
      : 0;

    return {
      ...this.healthMetrics,
      avgResponseTime: Math.round(avgResponseTime),
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length
    };
  }
}

module.exports = new ConcurrentHandler();
