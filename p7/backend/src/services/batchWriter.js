import pool from '../db/postgres.js';

class BatchWriter {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 500;
    this.flushInterval = options.flushInterval || 3000;
    this.maxRetries = options.maxRetries || 3;
    this.queues = new Map();
    this.flushTimers = new Map();
    this.isShuttingDown = false;
  }

  getQueue(tableName) {
    if (!this.queues.has(tableName)) {
      this.queues.set(tableName, []);
    }
    return this.queues.get(tableName);
  }

  async enqueue(tableName, data) {
    const queue = this.getQueue(tableName);
    queue.push(data);

    if (queue.length >= this.batchSize) {
      await this.flush(tableName);
    } else if (!this.flushTimers.has(tableName)) {
      const timer = setTimeout(() => this.flush(tableName), this.flushInterval);
      this.flushTimers.set(tableName, timer);
    }
  }

  async flush(tableName) {
    const queue = this.getQueue(tableName);
    if (queue.length === 0) return;

    const timer = this.flushTimers.get(tableName);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(tableName);
    }

    const batch = queue.splice(0, this.batchSize);
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        await this.batchInsert(tableName, batch);
        console.log(`Inserted ${batch.length} records into ${tableName}`);
        return;
      } catch (err) {
        retries++;
        console.error(`Batch insert failed (attempt ${retries}/${this.maxRetries}):`, err);
        if (retries >= this.maxRetries) {
          queue.unshift(...batch);
          throw err;
        }
        await new Promise(r => setTimeout(r, 1000 * retries));
      }
    }
  }

  async batchInsert(tableName, records) {
    if (records.length === 0) return;

    const columns = Object.keys(records[0]);
    const columnList = columns.join(', ');
    
    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    records.forEach(record => {
      const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
      valuePlaceholders.push(`(${placeholders})`);
      columns.forEach(col => values.push(record[col]));
    });

    const query = `
      INSERT INTO ${tableName} (${columnList})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    await pool.query(query, values);
  }

  async flushAll() {
    this.isShuttingDown = true;
    const promises = [];
    for (const tableName of this.queues.keys()) {
      promises.push(this.flush(tableName));
    }
    await Promise.allSettled(promises);
    console.log('All batches flushed');
  }

  getStats() {
    const stats = {};
    for (const [tableName, queue] of this.queues) {
      stats[tableName] = queue.length;
    }
    return stats;
  }
}

const batchWriter = new BatchWriter();

export default batchWriter;
export { BatchWriter };
