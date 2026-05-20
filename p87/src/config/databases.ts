import { Sequelize, Transaction } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000'),
  idle: parseInt(process.env.DB_POOL_IDLE || '30000'),
  evict: parseInt(process.env.DB_POOL_EVICT || '10000'),
  validate: (connection: any) => {
    return connection && !connection._invalid;
  }
};

const retryConfig = {
  max: 3,
  timeout: 5000,
  match: [
    'ConnectionRefusedError',
    'ConnectionTimedOutError',
    'HostNotFoundError',
    'HostNotReachableError',
    'ConnectionError'
  ]
};

export const processDB = new Sequelize(
  process.env.DB_PROCESS_NAME || 'lacquerware_process',
  process.env.DB_PROCESS_USER || 'postgres',
  process.env.DB_PROCESS_PASSWORD || 'postgres',
  {
    host: process.env.DB_PROCESS_HOST || 'localhost',
    port: parseInt(process.env.DB_PROCESS_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: poolConfig,
    retry: retryConfig,
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    dialectOptions: {
      connectTimeout: 60000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000
    }
  }
);

export const traceDB = new Sequelize(
  process.env.DB_TRACE_NAME || 'lacquerware_trace',
  process.env.DB_TRACE_USER || 'postgres',
  process.env.DB_TRACE_PASSWORD || 'postgres',
  {
    host: process.env.DB_TRACE_HOST || 'localhost',
    port: parseInt(process.env.DB_TRACE_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: poolConfig,
    retry: retryConfig,
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    dialectOptions: {
      connectTimeout: 60000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000
    }
  }
);

export const qualityDB = new Sequelize(
  process.env.DB_QUALITY_NAME || 'lacquerware_quality',
  process.env.DB_QUALITY_USER || 'postgres',
  process.env.DB_QUALITY_PASSWORD || 'postgres',
  {
    host: process.env.DB_QUALITY_HOST || 'localhost',
    port: parseInt(process.env.DB_QUALITY_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: poolConfig,
    retry: retryConfig,
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    dialectOptions: {
      connectTimeout: 60000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000
    }
  }
);

export const connectDatabases = async () => {
  try {
    await processDB.authenticate();
    console.log('工艺数据库连接成功');
    
    await traceDB.authenticate();
    console.log('溯源数据库连接成功');
    
    await qualityDB.authenticate();
    console.log('品质数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
};
