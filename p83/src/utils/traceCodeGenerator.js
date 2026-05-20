const crypto = require('crypto');
const TraceRecord = require('../models/trace/TraceRecord');

class TraceCodeGenerator {
  constructor() {
    this.counter = 0;
    this.lastTimestamp = 0;
  }

  generateTimestampCode() {
    const now = Date.now();
    
    if (now === this.lastTimestamp) {
      this.counter++;
    } else {
      this.counter = 0;
      this.lastTimestamp = now;
    }

    const timestamp = now.toString(36).toUpperCase();
    const counter = this.counter.toString(36).padStart(4, '0').toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    const prefix = 'TRACE';
    
    return `${prefix}-${timestamp}-${counter}-${random}`;
  }

  generateUUIDv4() {
    return crypto.randomUUID();
  }

  generateDeterministicCode(materialId, batchId, stage, timestamp) {
    const hash = crypto.createHash('sha256');
    hash.update(`${materialId}-${batchId}-${stage}-${timestamp}-${crypto.randomBytes(8).toString('hex')}`);
    const hashHex = hash.digest('hex').substring(0, 16).toUpperCase();
    
    return `TC-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}-${hashHex.substring(8, 12)}-${hashHex.substring(12, 16)}`;
  }

  async generateUniqueTraceId(maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const traceId = this.generateTimestampCode();
      
      const existing = await TraceRecord.findOne({ traceId });
      if (!existing) {
        return traceId;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
    
    const fallbackId = this.generateUUIDv4();
    console.warn(`溯源码生成重试${maxRetries}次后使用UUID回退方案: ${fallbackId}`);
    return fallbackId;
  }

  async batchGenerateUniqueCodes(count, maxRetries = 3) {
    const codes = new Set();
    const maxAttempts = count * maxRetries;
    let attempts = 0;

    while (codes.size < count && attempts < maxAttempts) {
      const code = this.generateTimestampCode();
      if (!codes.has(code)) {
        const existing = await TraceRecord.findOne({ traceId: code });
        if (!existing) {
          codes.add(code);
        }
      }
      attempts++;
    }

    return Array.from(codes);
  }

  validateTraceCode(traceId) {
    if (!traceId || typeof traceId !== 'string') {
      return false;
    }

    const timestampPattern = /^TRACE-[A-Z0-9]{7,11}-[A-Z0-9]{4}-[A-Z0-9]{6}$/;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const deterministicPattern = /^TC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

    return timestampPattern.test(traceId) || 
           uuidPattern.test(traceId) || 
           deterministicPattern.test(traceId);
  }

  extractTimestamp(traceId) {
    const match = traceId.match(/^TRACE-([A-Z0-9]+)-/);
    if (match) {
      return parseInt(match[1], 36);
    }
    return null;
  }
}

module.exports = new TraceCodeGenerator();
