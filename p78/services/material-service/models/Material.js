const { query } = require('../../../shared/utils/db');

class Material {
  constructor(pool) {
    this.pool = pool;
  }

  async create(materialData) {
    const sql = `
      INSERT INTO materials (
        code, name, category, origin_province, origin_city, origin_address,
        supplier_name, supplier_contact, unit, specifications, description,
        quality_standard, storage_requirements, shelf_life_days, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      materialData.code, materialData.name, materialData.category,
      materialData.origin_province, materialData.origin_city, materialData.origin_address,
      materialData.supplier_name, materialData.supplier_contact, materialData.unit,
      materialData.specifications, materialData.description,
      materialData.quality_standard, materialData.storage_requirements,
      materialData.shelf_life_days, materialData.created_by
    ]);
    return result.rows[0];
  }

  async findById(id) {
    const sql = 'SELECT * FROM materials WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async findByCode(code) {
    const sql = 'SELECT * FROM materials WHERE code = $1';
    const result = await query(this.pool, sql, [code]);
    return result.rows[0];
  }

  async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereConditions = ['is_active = true'];
    let params = [];
    let paramIndex = 1;

    if (filters.category) {
      whereConditions.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.name) {
      whereConditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    if (filters.origin_province) {
      whereConditions.push(`origin_province = $${paramIndex++}`);
      params.push(filters.origin_province);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT * FROM materials
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM materials ${whereClause}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      query(this.pool, sql, params),
      query(this.pool, countSql, countParams)
    ]);

    return {
      materials: result.rows,
      total: countResult.rows[0].count
    };
  }

  async update(id, materialData) {
    const sql = `
      UPDATE materials
      SET code = $1, name = $2, category = $3, origin_province = $4,
          origin_city = $5, origin_address = $6, supplier_name = $7,
          supplier_contact = $8, unit = $9, specifications = $10,
          description = $11, quality_standard = $12, storage_requirements = $13,
          shelf_life_days = $14, updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      materialData.code, materialData.name, materialData.category,
      materialData.origin_province, materialData.origin_city, materialData.origin_address,
      materialData.supplier_name, materialData.supplier_contact, materialData.unit,
      materialData.specifications, materialData.description,
      materialData.quality_standard, materialData.storage_requirements,
      materialData.shelf_life_days, id
    ]);
    return result.rows[0];
  }

  async delete(id) {
    const sql = 'UPDATE materials SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = Material;
