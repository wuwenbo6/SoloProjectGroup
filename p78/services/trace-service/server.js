require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createDbPool } = require('../../shared/utils/db');
const traceController = require('./controllers/traceController');
const traceRoutes = require('./routes/traceRoutes');

const app = express();
const PORT = process.env.TRACE_SERVICE_PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = createDbPool({
  host: process.env.TRACE_DB_HOST,
  port: process.env.TRACE_DB_PORT,
  database: process.env.TRACE_DB_NAME,
  user: process.env.TRACE_DB_USER,
  password: process.env.TRACE_DB_PASSWORD
});

traceController.initModels(pool);

app.use('/api/trace', traceRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`溯源数据服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/trace/health`);
});

module.exports = app;
