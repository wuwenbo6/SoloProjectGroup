const { query } = require('../../../shared/utils/db');

class ProcessingRecord {
  constructor(pool) {
    this.pool = pool;
  }

  async create(recordData) {
    const sql = `
      INSERT INTO processing_records (
        batch_id, process_stage, start_time, end_time, workshop,
        equipment_id, parameters, operator_id, operator_name,
        quality_check_result, inspector_id, inspector_name,
        inspection_notes, next_batch_id, output_quantity,
        output_unit, waste_quantity, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.batch_id, recordData.process_stage, recordData.start_time,
      recordData.end_time, recordData.workshop, recordData.equipment_id,
      recordData.parameters ? JSON.stringify(recordData.parameters) : null,
      recordData.operator_id, recordData.operator_name, recordData.quality_check_result,
      recordData.inspector_id, recordData.inspector_name, recordData.inspection_notes,
      recordData.next_batch_id, recordData.output_quantity, recordData.output_unit,
      recordData.waste_quantity, recordData.remarks
    ]);
    return result.rows[0];
  }

  async findByBatchId(batchId) {
    const sql = 'SELECT * FROM processing_records WHERE batch_id = $1 ORDER BY start_time ASC';
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM processing_records WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async update(id, recordData) {
    const sql = `
      UPDATE processing_records
      SET process_stage = $1, start_time = $2, end_time = $3, workshop = $4,
          equipment_id = $5, parameters = $6, operator_id = $7, operator_name = $8,
          quality_check_result = $9, inspector_id = $10, inspector_name = $11,
          inspection_notes = $12, next_batch_id = $13, output_quantity = $14,
          output_unit = $15, waste_quantity = $16, remarks = $17
      WHERE id = $18
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.process_stage, recordData.start_time, recordData.end_time,
      recordData.workshop, recordData.equipment_id,
      recordData.parameters ? JSON.stringify(recordData.parameters) : null,
      recordData.operator_id, recordData.operator_name, recordData.quality_check_result,
      recordData.inspector_id, recordData.inspector_name, recordData.inspection_notes,
      recordData.next_batch_id, recordData.output_quantity, recordData.output_unit,
      recordData.waste_quantity, recordData.remarks, id
    ]);
    return result.rows[0];
  }
}

module.exports = ProcessingRecord;
