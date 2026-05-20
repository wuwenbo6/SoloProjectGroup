require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createDbPool } = require('../../shared/utils/db');
const authController = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = createDbPool({
  host: process.env.AUTH_DB_HOST,
  port: process.env.AUTH_DB_PORT,
  database: process.env.AUTH_DB_NAME,
  user: process.env.AUTH_DB_USER,
  password: process.env.AUTH_DB_PASSWORD
});

authController.initModels(pool);

app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`认证服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/auth/health`);
});

module.exports = app;
