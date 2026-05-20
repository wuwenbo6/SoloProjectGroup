require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const thirdPartyController = require('./controllers/thirdPartyController');
const thirdPartyRoutes = require('./routes/thirdPartyRoutes');

const app = express();
const PORT = process.env.THIRDPARTY_SERVICE_PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

thirdPartyController.initClients();

app.use('/api/thirdparty', thirdPartyRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`第三方检测服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/thirdparty/health`);
});

module.exports = app;
