import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';
import { Batch, BatchCollection } from './models/Batch';

const app = express();
const PORT = process.env.BATCH_SERVICE_PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/batches', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await Batch.sync({ alter: process.env.NODE_ENV !== 'production' });
    await BatchCollection.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Batch models synchronized');

    app.listen(PORT, () => {
      logger.info(`Batch Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Batch Service:', error);
    process.exit(1);
  }
}

startServer();
