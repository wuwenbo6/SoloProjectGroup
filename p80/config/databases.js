const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const rareBookDB = new Sequelize(
  process.env.DB_RARE_BOOK_NAME,
  process.env.DB_RARE_BOOK_USER,
  process.env.DB_RARE_BOOK_PASSWORD,
  {
    host: process.env.DB_RARE_BOOK_HOST,
    port: process.env.DB_RARE_BOOK_PORT,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

const restorationDB = new Sequelize(
  process.env.DB_RESTORATION_NAME,
  process.env.DB_RESTORATION_USER,
  process.env.DB_RESTORATION_PASSWORD,
  {
    host: process.env.DB_RESTORATION_HOST,
    port: process.env.DB_RESTORATION_PORT,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

const techniqueDB = new Sequelize(
  process.env.DB_TECHNIQUE_NAME,
  process.env.DB_TECHNIQUE_USER,
  process.env.DB_TECHNIQUE_PASSWORD,
  {
    host: process.env.DB_TECHNIQUE_HOST,
    port: process.env.DB_TECHNIQUE_PORT,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

const connectAllDBs = async () => {
  try {
    await rareBookDB.authenticate();
    logger.info('Rare Book Database connected successfully');
    
    await restorationDB.authenticate();
    logger.info('Restoration Database connected successfully');
    
    await techniqueDB.authenticate();
    logger.info('Technique Database connected successfully');
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = {
  rareBookDB,
  restorationDB,
  techniqueDB,
  connectAllDBs
};
