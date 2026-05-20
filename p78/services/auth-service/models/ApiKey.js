const { query } = require('../../../shared/utils/db');
const crypto = require('crypto');

class ApiKey {
  constructor(pool) {
    this.pool = pool;
  }

  generateKey() {
    return 'tk_' + crypto.randomBytes(32).toString('hex');
  }

  async create(apiKeyData) {
    const apiKey = this.generateKey();
    const sql = `
      INSERT INTO api_keys (service_name, api_key, permissions, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, service_name, api_key, permissions, created_at, expires_at
    `;
    const result = await query(
      this.pool,
      sql,
      [apiKeyData.service_name, apiKey, JSON.stringify(apiKeyData.permissions || {}), apiKeyData.expires_at]
    );
    return result.rows[0];
  }

  async validateKey(apiKey) {
    const sql = `
      SELECT * FROM api_keys 
      WHERE api_key = $1 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const result = await query(this.pool, sql, [apiKey]);
    return result.rows[0];
  }

  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT id, service_name, permissions, is_active, created_at, expires_at
      FROM api_keys
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countSql = 'SELECT COUNT(*) FROM api_keys';
    
    const [result, countResult] = await Promise.all([
      query(this.pool, sql, [limit, offset]),
      query(this.pool, countSql)
    ]);

    return {
      apiKeys: result.rows,
      total: countResult.rows[0].count
    };
  }

  async revoke(id) {
    const sql = 'UPDATE api_keys SET is_active = false WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = ApiKey;
