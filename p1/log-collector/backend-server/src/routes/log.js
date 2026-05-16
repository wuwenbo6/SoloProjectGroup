const express = require('express');
const router = express.Router();

module.exports = function(redisService, clickhouseService) {
  const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '100');
  const RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '60');
  const IP_WHITELIST = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [];

  function getClientIp(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.connection?.socket?.remoteAddress || 
           'unknown';
  }

  function validateIp(ip) {
    if (IP_WHITELIST.length === 0) {
      return true;
    }
    return IP_WHITELIST.includes(ip) || IP_WHITELIST.includes('*');
  }

  function validateLogData(log) {
    return log && typeof log === 'object' && log.app_id && log.timestamp;
  }

  router.post('/', async (req, res) => {
    try {
      const clientIp = getClientIp(req);

      if (!validateIp(clientIp)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const allowed = await redisService.checkRateLimit(clientIp, RATE_LIMIT, RATE_WINDOW);
      if (!allowed) {
        return res.status(429).json({ error: 'Too Many Requests' });
      }

      const logs = Array.isArray(req.body) ? req.body : [req.body];
      
      if (logs.length === 0) {
        return res.status(400).json({ error: 'Empty log data' });
      }

      const validLogs = logs.filter(validateLogData);
      
      if (validLogs.length === 0) {
        return res.status(400).json({ error: 'Invalid log format' });
      }

      await redisService.pushLogs(validLogs);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error processing logs:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const { appId, userId, level, startTime, endTime, page, pageSize } = req.query;
      
      const result = await clickhouseService.queryLogs({
        appId,
        userId,
        level,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 20
      });

      res.json(result);
    } catch (error) {
      console.error('Error querying logs:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/stats', async (req, res) => {
    try {
      const pendingCount = await redisService.getPendingLogsCount();
      
      res.json({
        pending_logs: pendingCount
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/analytics/error-types', async (req, res) => {
    try {
      const { appId, startTime, endTime } = req.query;
      
      const result = await clickhouseService.getErrorTypeStats({
        appId,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined
      });

      res.json(result);
    } catch (error) {
      console.error('Error getting error type stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/analytics/error-rate-trend', async (req, res) => {
    try {
      const { appId, startTime, endTime, interval } = req.query;
      
      const result = await clickhouseService.getErrorRateTrend({
        appId,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined,
        interval
      });

      res.json(result);
    } catch (error) {
      console.error('Error getting error rate trend:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/analytics/level-distribution', async (req, res) => {
    try {
      const { appId, startTime, endTime } = req.query;
      
      const result = await clickhouseService.getLogLevelDistribution({
        appId,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined
      });

      res.json(result);
    } catch (error) {
      console.error('Error getting level distribution:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/analytics/user-errors', async (req, res) => {
    try {
      const { appId, startTime, endTime, limit } = req.query;
      
      const result = await clickhouseService.getUserErrorStats({
        appId,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined,
        limit: limit ? parseInt(limit) : undefined
      });

      res.json(result);
    } catch (error) {
      console.error('Error getting user error stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
};
