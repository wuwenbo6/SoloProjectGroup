const { Sequelize, Op } = require('sequelize');
const logger = require('./logger');

const createDatabaseConnection = (dbConfig) => {
  const maxPoolSize = parseInt(process.env.DB_POOL_MAX || '20');
  const minPoolSize = parseInt(process.env.DB_POOL_MIN || '5');
  const acquireTimeout = parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000');
  const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || '30000');

  const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port || 5432,
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      pool: {
        max: maxPoolSize,
        min: minPoolSize,
        acquire: acquireTimeout,
        idle: idleTimeout,
        evict: 10000,
        validate: async (connection) => {
          try {
            await connection.query('SELECT 1');
            return true;
          } catch (error) {
            logger.warn('数据库连接验证失败，连接已失效');
            return false;
          }
        }
      },
      retry: {
        max: 3,
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/
        ]
      },
      dialectOptions: {
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 30000
      }
    }
  );

  sequelize.addHook('afterConnect', (connection) => {
    logger.debug('数据库连接已建立，当前连接池状态:', {
      used: sequelize.connectionManager.pool._pool.waitingClientsCount,
      available: sequelize.connectionManager.pool._pool.availableObjectsCount
    });
  });

  sequelize.addHook('beforeDisconnect', () => {
    logger.debug('数据库连接即将关闭');
  });

  return sequelize;
};

const testConnection = async (sequelize) => {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    return true;
  } catch (error) {
    logger.error('数据库连接失败:', error);
    return false;
  }
};

const syncDatabase = async (sequelize, force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info('数据库同步完成');
    return true;
  } catch (error) {
    logger.error('数据库同步失败:', error);
    return false;
  }
};

module.exports = {
  createDatabaseConnection,
  testConnection,
  syncDatabase
};
