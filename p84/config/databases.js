const mongoose = require('mongoose');
const logger = require('./logger');

const connections = {};
const connectionHealth = {};

const createConnection = async (dbName, uri) => {
  try {
    const conn = await mongoose.createConnection(uri, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      readPreference: 'primaryPreferred',
      autoIndex: true,
    });
    
    conn.on('connected', () => {
      connectionHealth[dbName] = { status: 'healthy', lastCheck: new Date() };
      logger.info(`✅ ${dbName} 数据库连接成功`);
    });

    conn.on('disconnected', () => {
      connectionHealth[dbName] = { status: 'disconnected', lastCheck: new Date() };
      logger.warn(`⚠️ ${dbName} 数据库连接断开`);
    });

    conn.on('error', (err) => {
      connectionHealth[dbName] = { status: 'error', lastCheck: new Date(), error: err.message };
      logger.error(`❌ ${dbName} 数据库连接错误:`, err);
    });

    conn.on('reconnectFailed', () => {
      logger.error(`❌ ${dbName} 数据库重连失败`);
    });
    
    return conn;
  } catch (error) {
    logger.error(`❌ ${dbName} 数据库连接失败:`, error);
    throw error;
  }
};

const initDatabases = async () => {
  try {
    const connectionPromises = [
      createConnection('工艺数据库', process.env.DB_PROCESS_URI),
      createConnection('生产数据库', process.env.DB_PRODUCTION_URI),
      createConnection('品质数据库', process.env.DB_QUALITY_URI),
      createConnection('认证数据库', process.env.DB_AUTH_URI)
    ];

    const [processDB, productionDB, qualityDB, authDB] = await Promise.all(connectionPromises);
    
    connections.processDB = processDB;
    connections.productionDB = productionDB;
    connections.qualityDB = qualityDB;
    connections.authDB = authDB;
    
    logger.info('✅ 所有数据库连接初始化完成');
    return connections;
  } catch (error) {
    logger.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};

const getConnection = (dbName) => {
  if (!connections[dbName]) {
    throw new Error(`数据库连接 ${dbName} 未初始化`);
  }
  return connections[dbName];
};

const checkConnectionHealth = (dbName) => {
  return connectionHealth[dbName] || { status: 'unknown' };
};

const isConnectionHealthy = (dbName) => {
  const health = connectionHealth[dbName];
  return health && health.status === 'healthy';
};

const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(`操作重试 ${i + 1}/${maxRetries}:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
};

module.exports = { 
  initDatabases, 
  getConnection, 
  connections,
  checkConnectionHealth,
  isConnectionHealthy,
  retryOperation
};
