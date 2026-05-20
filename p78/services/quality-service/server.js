require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createDbPool } = require('../../shared/utils/db');
const qualityController = require('./controllers/qualityController');
const qualityRoutes = require('./routes/qualityRoutes');

const app = express();
const PORT = process.env.QUALITY_SERVICE_PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = createDbPool({
  host: process.env.QUALITY_DB_HOST,
  port: process.env.QUALITY_DB_PORT,
  database: process.env.QUALITY_DB_NAME,
  user: process.env.QUALITY_DB_USER,
  password: process.env.QUALITY_DB_PASSWORD
});

qualityController.initModels(pool);

app.use('/api/quality', qualityRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`品质分级服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/quality/health`);
});

module.exports = app;
