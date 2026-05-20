require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const sequelize = require('./config/database');
const { testConnection, syncDatabase } = require('../../../../shared/utils/database');
const logger = require('../../../../shared/utils/logger');
const { errorHandler } = require('../../../../shared/utils/errorHandler');
const { apiLimiter } = require('../../../../shared/utils/rateLimit');
const { requestTimeout, haltOnTimedout, handleTimeout } = require('../../../../shared/utils/timeout');
const batchRoutes = require('./routes/batchRoutes');

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestTimeout);
app.use('/api/', apiLimiter);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: '原料批次管理服务 API', version: '1.0.0', description: '传统手工艺品原料溯源系统 - 批次管理服务' },
    servers: [{ url: `http://localhost:${process.env.PORT || 3003}` }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  },
  apis: ['./src/routes/*.js']
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsDoc(swaggerOptions)));
app.use('/api/batches', batchRoutes);

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'success',
      message: '批次管理服务运行正常',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(503).json({
      status: 'error',
      message: '服务不可用',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

app.use(haltOnTimedout);
app.use(handleTimeout);
app.use(errorHandler);

const PORT = process.env.PORT || 3003;
const startServer = async () => {
  try {
    await testConnection(sequelize);
    await syncDatabase(sequelize, process.env.NODE_ENV === 'development');
    app.listen(PORT, () => {
      logger.info(`🚀 批次管理服务运行在端口 ${PORT}`);
      logger.info(`📚 Swagger 文档: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};
startServer();
module.exports = app;
