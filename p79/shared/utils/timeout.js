const timeout = require('connect-timeout');
const logger = require('./logger');

const createTimeout = (ms = 30000) => {
  return timeout(ms);
};

const haltOnTimedout = (req, res, next) => {
  if (!req.timedout) next();
};

const handleTimeout = (err, req, res, next) => {
  if (err.timeout) {
    logger.error(`请求超时: ${req.method} ${req.path} - ${err.message}`);
    return res.status(504).json({
      success: false,
      message: '请求超时，请稍后重试',
      error: 'REQUEST_TIMEOUT'
    });
  }
  next(err);
};

const requestTimeout = createTimeout(30000);
const longRequestTimeout = createTimeout(120000);

module.exports = {
  createTimeout,
  haltOnTimedout,
  handleTimeout,
  requestTimeout,
  longRequestTimeout
};
