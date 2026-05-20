const { query, transaction } = require('../../../shared/utils/db');

class User {
  constructor(pool) {
    this.pool = pool;
  }

  async create(userData) {
    const sql = `
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, created_at
    `;
    const result = await query(
      this.pool,
      sql,
      [userData.username, userData.email, userData.password_hash, userData.role || 'user']
    );
    return result.rows[0];
  }

  async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    const result = await query(this.pool, sql, [username]);
    return result.rows[0];
  }

  async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await query(this.pool, sql, [email]);
    return result.rows[0];
  }

  async findById(id) {
    const sql = 'SELECT id, username, email, role, created_at FROM users WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT id, username, email, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countSql = 'SELECT COUNT(*) FROM users';
    
    const [result, countResult] = await Promise.all([
      query(this.pool, sql, [limit, offset]),
      query(this.pool, countSql)
    ]);

    return {
      users: result.rows,
      total: countResult.rows[0].count
    };
  }

  async update(id, userData) {
    const sql = `
      UPDATE users
      SET username = $1, email = $2, role = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, username, email, role, is_active
    `;
    const result = await query(
      this.pool,
      sql,
      [userData.username, userData.email, userData.role, userData.is_active, id]
    );
    return result.rows[0];
  }

  async delete(id) {
    const sql = 'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = User;
