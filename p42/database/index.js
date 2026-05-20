const { Pool } = require('pg');

class Database {
  constructor(config) {
    this.pool = new Pool(config);
  }

  async init() {
    await this.createTables();
  }

  async createTables() {
    const query = `
      CREATE TABLE IF NOT EXISTS register_history (
        id SERIAL PRIMARY KEY,
        register_type VARCHAR(50) NOT NULL,
        address INTEGER NOT NULL,
        value INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_register_history_timestamp ON register_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_register_history_type_address ON register_history(register_type, address);
    `;
    await this.pool.query(query);
  }

  async insertRegisterData(registerType, address, value) {
    const query = `
      INSERT INTO register_history (register_type, address, value)
      VALUES ($1, $2, $3)
    `;
    await this.pool.query(query, [registerType, address, value]);
  }

  async batchInsertRegisterData(dataArray) {
    if (dataArray.length === 0) return;
    
    const values = [];
    const placeholders = [];
    
    dataArray.forEach((data, index) => {
      const base = index * 3;
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      values.push(data.registerType, data.address, data.value);
    });
    
    const query = `
      INSERT INTO register_history (register_type, address, value)
      VALUES ${placeholders.join(', ')}
    `;
    await this.pool.query(query, values);
  }

  async getRegisterHistory(registerType, address, startTime, endTime) {
    let query = `
      SELECT value, timestamp
      FROM register_history
      WHERE register_type = $1 AND address = $2
    `;
    const params = [registerType, address];
    
    if (startTime && endTime) {
      query += ' AND timestamp BETWEEN $3 AND $4';
      params.push(startTime, endTime);
    }
    
    query += ' ORDER BY timestamp ASC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getRegisterHistoryByType(registerType, startTime, endTime) {
    let query = `
      SELECT address, value, timestamp
      FROM register_history
      WHERE register_type = $1
    `;
    const params = [registerType];
    
    if (startTime && endTime) {
      query += ' AND timestamp BETWEEN $2 AND $3';
      params.push(startTime, endTime);
    }
    
    query += ' ORDER BY address, timestamp ASC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = Database;
