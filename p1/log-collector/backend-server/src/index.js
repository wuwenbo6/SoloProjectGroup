require('dotenv').config();

const express = require('express');
const cors = require('cors');
const zlib = require('zlib');
const { promisify } = require('util');
const RedisService = require('./services/redis');
const ClickHouseService = require('./services/clickhouse');
const createLogRoutes = require('./routes/log');

const gunzip = promisify(zlib.gunzip);

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '5000');
const SYNC_BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '50');
const MAX_RETRY_COUNT = parseInt(process.env.MAX_RETRY_COUNT || '3');
const SYNC_TIMEOUT = parseInt(process.env.SYNC_TIMEOUT || '30000');

app.use(cors());
app.use(express.raw({ type: 'application/gzip', limit: '10mb' }));

app.use(async (req, res, next) => {
  if (req.headers['content-encoding'] === 'gzip' || req.headers['content-type'] === 'application/gzip') {
    try {
      const decompressed = await gunzip(req.body);
      req.body = JSON.parse(decompressed.toString());
    } catch (error) {
      return res.status(400).json({ error: 'Invalid gzip compressed data' });
    }
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

let redisService;
let clickhouseService;
let syncTimer;
let isSyncing = false;

async function syncLogs() {
  if (isSyncing) {
    return;
  }
  
  isSyncing = true;
  
  try {
    const movedBackCount = await redisService.moveFailedLogsBack();
    if (movedBackCount > 0) {
      console.log(`Moved ${movedBackCount} failed logs back to pending queue`);
    }

    const pendingCount = await redisService.getPendingLogsCount();
    
    if (pendingCount === 0) {
      isSyncing = false;
      return;
    }

    let totalSynced = 0;
    let retryCount = 0;
    
    while (totalSynced < pendingCount && retryCount < MAX_RETRY_COUNT) {
      const logs = await redisService.getPendingLogs(SYNC_BATCH_SIZE);
      
      if (logs.length === 0) {
        break;
      }

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ClickHouse insert timeout')), SYNC_TIMEOUT);
        });

        await Promise.race([
          clickhouseService.insertLogs(logs),
          timeoutPromise
        ]);
        
        await redisService.removeProcessedLogs(logs.length);
        totalSynced += logs.length;
        retryCount = 0;
        
        console.log(`Synced ${logs.length} logs to ClickHouse, total synced: ${totalSynced}, pending: ${pendingCount - totalSynced}`);
      } catch (batchError) {
        retryCount++;
        console.error(`Batch sync failed (attempt ${retryCount}/${MAX_RETRY_COUNT}):`, batchError.message);
        
        await redisService.moveFailedLogsBack();
        
        if (retryCount >= MAX_RETRY_COUNT) {
          console.error('Max retry count reached, stopping current sync cycle');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  } catch (error) {
    console.error('Error syncing logs:', error);
    try {
      await redisService.moveFailedLogsBack();
    } catch (moveError) {
      console.error('Error moving failed logs back:', moveError);
    }
  } finally {
    isSyncing = false;
  }
}

function startSyncJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  syncTimer = setInterval(syncLogs, SYNC_INTERVAL);
  console.log(`Log sync job started, interval: ${SYNC_INTERVAL}ms, batch size: ${SYNC_BATCH_SIZE}`);
}

async function initServices() {
  console.log('Initializing Redis service...');
  redisService = new RedisService();
  
  console.log('Initializing ClickHouse service...');
  clickhouseService = new ClickHouseService();
  await clickhouseService.init();
  console.log('ClickHouse initialized successfully');
}

async function start() {
  try {
    await initServices();
    
    app.use('/api/logs', createLogRoutes(redisService, clickhouseService));
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });
    
    app.listen(PORT, () => {
      console.log(`Log collector server running on port ${PORT}`);
      startSyncJob();
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  
  await syncLogs();
  
  if (redisService) {
    redisService.close();
  }
  
  console.log('Shutdown complete');
  process.exit(0);
}

start();
