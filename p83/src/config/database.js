const mongoose = require('mongoose');

const connections = {};

const createConnection = (uri, dbName) => {
  connections[dbName] = mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  connections[dbName].on('connected', () => {
    console.log(`${dbName} connected successfully');
  });

  connections[dbName].on('error', (err) => {
    console.error(`${dbName} connection error:`, err);
  });

  connections[dbName].on('disconnected', () => {
    console.log(`${dbName} disconnected`);
  });

  return connections[dbName];
};

const connectAllDatabases = async () => {
  try {
    createConnection(process.env.MATERIAL_DB_URI, 'material');
    createConnection(process.env.TRACE_DB_URI, 'trace');
    createConnection(process.env.QUALITY_DB_URI, 'quality');
    createConnection(process.env.AUTH_DB_URI, 'auth');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const getConnection = (dbName) => connections[dbName];

process.on('SIGINT', async () => {
  for (const [name, conn] of Object.entries(connections)) {
    await conn.close();
    console.log(`${name} connection closed through app termination`);
  }
  process.exit(0);
});

module.exports = { connectAllDatabases, getConnection };
