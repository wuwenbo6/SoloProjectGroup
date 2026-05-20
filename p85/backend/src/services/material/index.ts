import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';
import { Material } from './models/Material';

const app = express();
const PORT = process.env.MATERIAL_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/materials', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await Material.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Material model synchronized');

    app.listen(PORT, () => {
      logger.info(`Material Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Material Service:', error);
    process.exit(1);
  }
}

startServer();
