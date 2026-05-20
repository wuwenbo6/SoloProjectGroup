const { query } = require('../../../shared/utils/db');

class TraceRecord {
  constructor(pool) {
    this.pool = pool;
  }

  async create(recordData) {
    const sql = `
      INSERT INTO trace_records (
        batch_id, trace_type, operation_type, operation_time, operator_id,
        operator_name, location, longitude, latitude, temperature, humidity,
        description, equipment_info, next_process, previous_record_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.batch_id, recordData.trace_type, recordData.operation_type,
      recordData.operation_time, recordData.operator_id, recordData.operator_name,
      recordData.location, recordData.longitude, recordData.latitude,
      recordData.temperature, recordData.humidity, recordData.description,
      recordData.equipment_info ? JSON.stringify(recordData.equipment_info) : null,
      recordData.next_process, recordData.previous_record_id
    ]);
    return result.rows[0];
  }

  async findByBatchId(batchId) {
    const sql = `
      SELECT * FROM trace_records
      WHERE batch_id = $1 AND is_valid = true
      ORDER BY operation_time ASC
    `;
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM trace_records WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereConditions = ['is_valid = true'];
    let params = [];
    let paramIndex = 1;

    if (filters.batch_id) {
      whereConditions.push(`batch_id = $${paramIndex++}`);
      params.push(filters.batch_id);
    }

    if (filters.trace_type) {
      whereConditions.push(`trace_type = $${paramIndex++}`);
      params.push(filters.trace_type);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const sql = `
      SELECT * FROM trace_records
      ${whereClause}
      ORDER BY operation_time DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM trace_records ${whereClause}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      query(this.pool, sql, params),
      query(this.pool, countSql, countParams)
    ]);

    return {
      records: result.rows,
      total: countResult.rows[0].count
    };
  }

  async invalidate(id) {
    const sql = 'UPDATE trace_records SET is_valid = false WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = TraceRecord;
