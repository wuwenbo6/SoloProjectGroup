require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createDbPool } = require('../../shared/utils/db');
const materialController = require('./controllers/materialController');
const materialRoutes = require('./routes/materialRoutes');

const app = express();
const PORT = process.env.MATERIAL_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = createDbPool({
  host: process.env.MATERIAL_DB_HOST,
  port: process.env.MATERIAL_DB_PORT,
  database: process.env.MATERIAL_DB_NAME,
  user: process.env.MATERIAL_DB_USER,
  password: process.env.MATERIAL_DB_PASSWORD
});

materialController.initModels(pool);

app.use('/api/materials', materialRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`原料信息服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/materials/health`);
});

module.exports = app;
