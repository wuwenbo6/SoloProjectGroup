const { query } = require('../../../shared/utils/db');

class OriginRecord {
  constructor(pool) {
    this.pool = pool;
  }

  async create(recordData) {
    const sql = `
      INSERT INTO origin_records (
        batch_id, harvest_date, plot_number, soil_type, fertilizer_info,
        pesticide_info, irrigation_info, farmer_name, farmer_contact,
        quality_check_result, inspector_id, inspector_name, inspection_date,
        photos, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.batch_id, recordData.harvest_date, recordData.plot_number,
      recordData.soil_type, recordData.fertilizer_info, recordData.pesticide_info,
      recordData.irrigation_info, recordData.farmer_name, recordData.farmer_contact,
      recordData.quality_check_result, recordData.inspector_id, recordData.inspector_name,
      recordData.inspection_date, recordData.photos ? JSON.stringify(recordData.photos) : null,
      recordData.remarks
    ]);
    return result.rows[0];
  }

  async findByBatchId(batchId) {
    const sql = 'SELECT * FROM origin_records WHERE batch_id = $1 ORDER BY created_at DESC';
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM origin_records WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async update(id, recordData) {
    const sql = `
      UPDATE origin_records
      SET harvest_date = $1, plot_number = $2, soil_type = $3, fertilizer_info = $4,
          pesticide_info = $5, irrigation_info = $6, farmer_name = $7, farmer_contact = $8,
          quality_check_result = $9, inspector_id = $10, inspector_name = $11,
          inspection_date = $12, photos = $13, remarks = $14
      WHERE id = $15
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.harvest_date, recordData.plot_number, recordData.soil_type,
      recordData.fertilizer_info, recordData.pesticide_info, recordData.irrigation_info,
      recordData.farmer_name, recordData.farmer_contact, recordData.quality_check_result,
      recordData.inspector_id, recordData.inspector_name, recordData.inspection_date,
      recordData.photos ? JSON.stringify(recordData.photos) : null, recordData.remarks, id
    ]);
    return result.rows[0];
  }
}

module.exports = OriginRecord;
