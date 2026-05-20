const mongoose = require('mongoose');

const connections = {};

const dbOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 100,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  w: 'majority',
  wtimeout: 10000,
  retryWrites: true,
  retryReads: true,
};

const connectCraftDB = async () => {
  try {
    const conn = await mongoose.createConnection(process.env.DB_CRAFT_URI, dbOptions);
    console.log('工艺数据库连接成功');
    connections.craft = conn;
    return conn;
  } catch (error) {
    console.error('工艺数据库连接失败:', error);
    process.exit(1);
  }
};

const connectProductionDB = async () => {
  try {
    const conn = await mongoose.createConnection(process.env.DB_PRODUCTION_URI, dbOptions);
    console.log('制作记录数据库连接成功');
    connections.production = conn;
    return conn;
  } catch (error) {
    console.error('制作记录数据库连接失败:', error);
    process.exit(1);
  }
};

const connectQualityDB = async () => {
  try {
    const conn = await mongoose.createConnection(process.env.DB_QUALITY_URI, dbOptions);
    console.log('品质数据库连接成功');
    connections.quality = conn;
    return conn;
  } catch (error) {
    console.error('品质数据库连接失败:', error);
    process.exit(1);
  }
};

const connectAuthDB = async () => {
  try {
    const conn = await mongoose.createConnection(process.env.DB_AUTH_URI, dbOptions);
    console.log('认证数据库连接成功');
    connections.auth = conn;
    return conn;
  } catch (error) {
    console.error('认证数据库连接失败:', error);
    process.exit(1);
  }
};

const connectAllDBs = async () => {
  await Promise.all([
    connectCraftDB(),
    connectProductionDB(),
    connectQualityDB(),
    connectAuthDB(),
  ]);
};

const getDBStats = () => {
  const stats = {};
  Object.keys(connections).forEach(key => {
    if (connections[key] && connections[key].db) {
      stats[key] = {
        readyState: connections[key].readyState,
        host: connections[key].host,
        name: connections[key].name,
      };
    }
  });
  return stats;
};

module.exports = {
  connections,
  connectAllDBs,
  connectCraftDB,
  connectProductionDB,
  connectQualityDB,
  connectAuthDB,
  getDBStats,
};