import { Sequelize } from 'sequelize';
import logger from '../middleware/logger';

const databases = {
  material: null as Sequelize | null,
  collection: null as Sequelize | null,
  inspection: null as Sequelize | null,
};

const poolConfig = {
  max: 20,
  min: 5,
  acquire: 60000,
  idle: 10000,
};

export function initMaterialDatabase(): Sequelize {
  if (databases.material) {
    return databases.material;
  }

  databases.material = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_MATERIAL_HOST || 'localhost',
    port: parseInt(process.env.DB_MATERIAL_PORT || '5432'),
    database: process.env.DB_MATERIAL_NAME || 'material_db',
    username: process.env.DB_MATERIAL_USER || 'postgres',
    password: process.env.DB_MATERIAL_PASSWORD || 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: poolConfig,
  });

  return databases.material;
}

export function initCollectionDatabase(): Sequelize {
  if (databases.collection) {
    return databases.collection;
  }

  databases.collection = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_COLLECTION_HOST || 'localhost',
    port: parseInt(process.env.DB_COLLECTION_PORT || '5432'),
    database: process.env.DB_COLLECTION_NAME || 'collection_db',
    username: process.env.DB_COLLECTION_USER || 'postgres',
    password: process.env.DB_COLLECTION_PASSWORD || 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: poolConfig,
  });

  return databases.collection;
}

export function initInspectionDatabase(): Sequelize {
  if (databases.inspection) {
    return databases.inspection;
  }

  databases.inspection = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_INSPECTION_HOST || 'localhost',
    port: parseInt(process.env.DB_INSPECTION_PORT || '5432'),
    database: process.env.DB_INSPECTION_NAME || 'inspection_db',
    username: process.env.DB_INSPECTION_USER || 'postgres',
    password: process.env.DB_INSPECTION_PASSWORD || 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: poolConfig,
  });

  return databases.inspection;
}

export async function testConnections(): Promise<void> {
  try {
    await initMaterialDatabase().authenticate();
    logger.info('Material database connection established successfully');

    await initCollectionDatabase().authenticate();
    logger.info('Collection database connection established successfully');

    await initInspectionDatabase().authenticate();
    logger.info('Inspection database connection established successfully');
  } catch (error) {
    logger.error('Unable to connect to one or more databases:', error);
    throw error;
  }
}
