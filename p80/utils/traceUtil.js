const logger = require('./logger');

class TraceUtil {
  static generateTraceId() {
    return `TRACE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static logOperation(traceId, operation, data, userId = null) {
    const logEntry = {
      traceId,
      operation,
      timestamp: new Date().toISOString(),
      userId,
      data
    };
    logger.info('Operation trace:', logEntry);
    return logEntry;
  }

  static createTraceChain(bookId) {
    return {
      bookId,
      traceId: this.generateTraceId(),
      events: [],
      createdAt: new Date().toISOString()
    };
  }

  static addEvent(traceChain, eventType, eventData, userId = null) {
    traceChain.events.push({
      eventType,
      eventData,
      userId,
      timestamp: new Date().toISOString()
    });
    return traceChain;
  }
}

module.exports = TraceUtil;
