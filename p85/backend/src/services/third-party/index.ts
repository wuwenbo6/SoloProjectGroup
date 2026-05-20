import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';

const app = express();
const PORT = process.env.THIRD_PARTY_SERVICE_PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/third-party', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    app.listen(PORT, () => {
      logger.info(`Third Party Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Third Party Service:', error);
    process.exit(1);
  }
}

startServer();
