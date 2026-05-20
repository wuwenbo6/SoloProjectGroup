const mongoose = require('mongoose');

const connections = {};

const connectDatabases = async () => {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  
  connections.processDB = await mongoose.createConnection(`${baseUri}/brewing_process`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to brewing_process database');

  connections.userDB = await mongoose.createConnection(`${baseUri}/brewing_user`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to brewing_user database');

  connections.interactionDB = await mongoose.createConnection(`${baseUri}/brewing_interaction`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to brewing_interaction database');

  return connections;
};

const getConnection = (dbName) => connections[dbName];

module.exports = { connectDatabases, getConnection };
