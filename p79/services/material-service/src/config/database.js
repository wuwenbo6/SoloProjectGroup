require('dotenv').config();
const { createDatabaseConnection } = require('../../../../shared/utils/database');

const sequelize = createDatabaseConnection({
  database: process.env.DB_NAME,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT
});

module.exports = sequelize;
