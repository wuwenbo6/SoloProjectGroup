const { query } = require('../../../shared/utils/db');

class MaterialCategory {
  constructor(pool) {
    this.pool = pool;
  }

  async create(categoryData) {
    const sql = `
      INSERT INTO material_categories (name, code, description, parent_id, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      categoryData.name, categoryData.code, categoryData.description,
      categoryData.parent_id, categoryData.sort_order || 0
    ]);
    return result.rows[0];
  }

  async findAll() {
    const sql = `
      SELECT * FROM material_categories
      WHERE is_active = true
      ORDER BY sort_order, name
    `;
    const result = await query(this.pool, sql);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM material_categories WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async update(id, categoryData) {
    const sql = `
      UPDATE material_categories
      SET name = $1, code = $2, description = $3, parent_id = $4, sort_order = $5
      WHERE id = $6
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      categoryData.name, categoryData.code, categoryData.description,
      categoryData.parent_id, categoryData.sort_order, id
    ]);
    return result.rows[0];
  }

  async delete(id) {
    const sql = 'UPDATE material_categories SET is_active = false WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = MaterialCategory;
