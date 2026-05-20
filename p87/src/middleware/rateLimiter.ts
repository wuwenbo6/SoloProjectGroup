import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  private getClientKey(req: Request): string {
    return req.ip ||
      req.socket.remoteAddress ||
      req.headers['x-forwarded-for'] as string ||
      'unknown';
  }

  public middleware = (req: Request, res: Response, next: NextFunction) => {
    const clientKey = this.getClientKey(req);
    const now = Date.now();

    let record = this.requests.get(clientKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs
      };
      this.requests.set(clientKey, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.maxRequests - record.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

    if (record.count > this.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter
      });
    }

    next();
  };

  public cleanup() {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new RateLimiter(60000, 200);

export const strictRateLimiter = new RateLimiter(60000, 50);

setInterval(() => {
  globalRateLimiter.cleanup();
  strictRateLimiter.cleanup();
}, 60000);

export default globalRateLimiter.middleware;
