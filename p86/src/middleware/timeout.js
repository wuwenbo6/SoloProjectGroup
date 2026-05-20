const timeout = (ms = 30000) => {
  return (req, res, next) => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          message: '请求超时，请稍后重试',
          path: req.path,
          timeout: ms,
        });
      }
    }, ms);

    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    const clearTimeoutOnResponse = () => {
      clearTimeout(timeoutId);
    };

    res.send = function(...args) {
      clearTimeoutOnResponse();
      return originalSend.apply(this, args);
    };

    res.json = function(...args) {
      clearTimeoutOnResponse();
      return originalJson.apply(this, args);
    };

    res.end = function(...args) {
      clearTimeoutOnResponse();
      return originalEnd.apply(this, args);
    };

    req.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
};

exports.requestTimeout = timeout;
exports.shortTimeout = timeout(10000);
exports.mediumTimeout = timeout(30000);
exports.longTimeout = timeout(60000);
