import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from '../../shared/middleware/errorHandler';
import logger from '../../shared/middleware/logger';
import { User } from './models/User';

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await User.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('User model synchronized');

    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Auth Service:', error);
    process.exit(1);
  }
}

startServer();
