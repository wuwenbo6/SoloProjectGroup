import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';
import { Collection } from './models/Collection';

const app = express();
const PORT = process.env.COLLECTION_SERVICE_PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/collection', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await Collection.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Collection model synchronized');

    app.listen(PORT, () => {
      logger.info(`Collection Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Collection Service:', error);
    process.exit(1);
  }
}

startServer();
