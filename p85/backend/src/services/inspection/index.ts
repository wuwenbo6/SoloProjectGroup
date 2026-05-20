import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';
import { Inspection, ThirdPartyAgency } from './models/Inspection';

const app = express();
const PORT = process.env.INSPECTION_SERVICE_PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/inspection', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await Inspection.sync({ alter: process.env.NODE_ENV !== 'production' });
    await ThirdPartyAgency.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Inspection models synchronized');

    app.listen(PORT, () => {
      logger.info(`Inspection Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Inspection Service:', error);
    process.exit(1);
  }
}

startServer();
