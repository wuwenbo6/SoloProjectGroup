const { query } = require('../../../shared/utils/db');

class TransportRecord {
  constructor(pool) {
    this.pool = pool;
  }

  async create(recordData) {
    const sql = `
      INSERT INTO transport_records (
        batch_id, transport_type, vehicle_number, driver_name, driver_contact,
        departure_location, arrival_location, departure_time, arrival_time,
        temperature_control, transport_condition, cargo_status, handler_name, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.batch_id, recordData.transport_type, recordData.vehicle_number,
      recordData.driver_name, recordData.driver_contact, recordData.departure_location,
      recordData.arrival_location, recordData.departure_time, recordData.arrival_time,
      recordData.temperature_control ? JSON.stringify(recordData.temperature_control) : null,
      recordData.transport_condition, recordData.cargo_status,
      recordData.handler_name, recordData.remarks
    ]);
    return result.rows[0];
  }

  async findByBatchId(batchId) {
    const sql = 'SELECT * FROM transport_records WHERE batch_id = $1 ORDER BY departure_time ASC';
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM transport_records WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async update(id, recordData) {
    const sql = `
      UPDATE transport_records
      SET transport_type = $1, vehicle_number = $2, driver_name = $3, driver_contact = $4,
          departure_location = $5, arrival_location = $6, departure_time = $7, arrival_time = $8,
          temperature_control = $9, transport_condition = $10, cargo_status = $11,
          handler_name = $12, remarks = $13
      WHERE id = $14
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      recordData.transport_type, recordData.vehicle_number, recordData.driver_name,
      recordData.driver_contact, recordData.departure_location, recordData.arrival_location,
      recordData.departure_time, recordData.arrival_time,
      recordData.temperature_control ? JSON.stringify(recordData.temperature_control) : null,
      recordData.transport_condition, recordData.cargo_status,
      recordData.handler_name, recordData.remarks, id
    ]);
    return result.rows[0];
  }
}

module.exports = TransportRecord;
