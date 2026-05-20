const { query, transaction } = require('../../../shared/utils/db');
const crypto = require('crypto');

class Batch {
  constructor(pool) {
    this.pool = pool;
  }

  generateSecureBatchNo(materialCode) {
    const prefix = materialCode ? materialCode.substring(0, 3).toUpperCase() : 'BAT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 4);
    return `${prefix}-${timestamp}-${random}`;
  }

  async generateBatchNo(materialCode) {
    const prefix = materialCode ? materialCode.substring(0, 3).toUpperCase() : 'BAT';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    try {
      const result = await transaction(this.pool, async (client) => {
        await client.query('LOCK TABLE material_batches IN EXCLUSIVE MODE');
        
        const seqResult = await client.query(
          `SELECT COALESCE(MAX(SUBSTR(batch_no, 13)::INTEGER), 0) + 1 as next_seq 
           FROM material_batches 
           WHERE batch_no LIKE $1 || $2 || '%'`,
          [prefix, today]
        );
        
        const nextSeq = seqResult.rows[0].next_seq;
        const batchNo = `${prefix}${today}${nextSeq.toString().padStart(4, '0')}`;
        
        const exists = await client.query('SELECT 1 FROM material_batches WHERE batch_no = $1', [batchNo]);
        if (exists.rows.length > 0) {
          return this.generateSecureBatchNo(materialCode);
        }
        return batchNo;
      });
      return result;
    } catch (err) {
      console.warn('数据库锁获取失败，使用安全回退:', err.message);
      return this.generateSecureBatchNo(materialCode);
    }
  }

  async create(batchData) {
    const batchNo = batchData.batch_no || await this.generateBatchNo(batchData.material_code);
    const sql = `
      INSERT INTO material_batches (
        batch_no, material_id, material_name, material_code, quantity, unit,
        supplier_id, supplier_name, production_date, expiry_date,
        warehouse_id, warehouse_name, location, status, current_stage,
        quality_grade, remarks, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    try {
      const result = await query(this.pool, sql, [
        batchNo, batchData.material_id, batchData.material_name, batchData.material_code,
        batchData.quantity, batchData.unit, batchData.supplier_id, batchData.supplier_name,
        batchData.production_date, batchData.expiry_date, batchData.warehouse_id,
        batchData.warehouse_name, batchData.location, batchData.status || 'PENDING',
        batchData.current_stage, batchData.quality_grade, batchData.remarks, batchData.created_by
      ]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'material_batches_batch_no_key') {
        const retryBatchNo = this.generateSecureBatchNo(batchData.material_code);
        const retryResult = await query(this.pool, sql, [
          retryBatchNo, batchData.material_id, batchData.material_name, batchData.material_code,
          batchData.quantity, batchData.unit, batchData.supplier_id, batchData.supplier_name,
          batchData.production_date, batchData.expiry_date, batchData.warehouse_id,
          batchData.warehouse_name, batchData.location, batchData.status || 'PENDING',
          batchData.current_stage, batchData.quality_grade, batchData.remarks, batchData.created_by
        ]);
        return retryResult.rows[0];
      }
      throw err;
    }
  }

  async findById(id) {
    const sql = 'SELECT * FROM material_batches WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async findByBatchNo(batchNo) {
    const sql = 'SELECT * FROM material_batches WHERE batch_no = $1';
    const result = await query(this.pool, sql, [batchNo]);
    return result.rows[0];
  }

  async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.material_id) {
      whereConditions.push(`material_id = $${paramIndex++}`);
      params.push(filters.material_id);
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.quality_grade) {
      whereConditions.push(`quality_grade = $${paramIndex++}`);
      params.push(filters.quality_grade);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT * FROM material_batches
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM material_batches ${whereClause}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      query(this.pool, sql, params),
      query(this.pool, countSql, countParams)
    ]);

    return {
      batches: result.rows,
      total: countResult.rows[0].count
    };
  }

  async updateStatus(id, status, remarks = null) {
    const sql = `
      UPDATE material_batches
      SET status = $1, remarks = COALESCE($2, remarks), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await query(this.pool, sql, [status, remarks, id]);
    return result.rows[0];
  }

  async updateStage(id, stage) {
    const sql = `
      UPDATE material_batches
      SET current_stage = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(this.pool, sql, [stage, id]);
    return result.rows[0];
  }

  async addFlowRecord(flowData) {
    const sql = `
      INSERT INTO batch_flow_records (
        batch_id, from_stage, to_stage, operation_type, quantity,
        operator_id, operator_name, from_location, to_location,
        equipment_id, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      flowData.batch_id, flowData.from_stage, flowData.to_stage,
      flowData.operation_type, flowData.quantity, flowData.operator_id,
      flowData.operator_name, flowData.from_location, flowData.to_location,
      flowData.equipment_id, flowData.remarks
    ]);
    return result.rows[0];
  }

  async getFlowRecords(batchId) {
    const sql = `
      SELECT * FROM batch_flow_records
      WHERE batch_id = $1
      ORDER BY operation_time ASC
    `;
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async getExpiryWarnings(daysThreshold = 30) {
    const sql = `
      SELECT 
        mb.*,
        m.category as material_category,
        m.origin_province,
        m.origin_city,
        (mb.expiry_date - CURRENT_DATE) as days_to_expiry,
        CASE 
          WHEN (mb.expiry_date - CURRENT_DATE) <= 0 THEN 'EXPIRED'
          WHEN (mb.expiry_date - CURRENT_DATE) <= 7 THEN 'CRITICAL'
          WHEN (mb.expiry_date - CURRENT_DATE) <= 30 THEN 'WARNING'
          ELSE 'NOTICE'
        END as warning_level
      FROM material_batches mb
      LEFT JOIN materials m ON mb.material_id = m.id
      WHERE mb.expiry_date IS NOT NULL 
        AND mb.status = 'INSTOCK'
        AND (mb.expiry_date - CURRENT_DATE) <= $1
      ORDER BY days_to_expiry ASC, batch_no ASC
    `;
    const result = await query(this.pool, sql, [daysThreshold]);
    return result.rows;
  }

  async createWarning(warningData) {
    const sql = `
      INSERT INTO batch_warnings (
        batch_id, warning_type, warning_level, warning_message,
        threshold_value, current_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      warningData.batch_id,
      warningData.warning_type || 'EXPIRY',
      warningData.warning_level || 'WARNING',
      warningData.warning_message,
      warningData.threshold_value,
      warningData.current_value
    ]);
    return result.rows[0];
  }

  async getWarnings(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let whereConditions = ['1=1'];
    let params = [];
    let paramIndex = 1;

    if (filters.warning_type) {
      whereConditions.push(`warning_type = $${paramIndex++}`);
      params.push(filters.warning_type);
    }

    if (filters.warning_level) {
      whereConditions.push(`warning_level = $${paramIndex++}`);
      params.push(filters.warning_level);
    }

    if (filters.is_acknowledged !== undefined) {
      whereConditions.push(`is_acknowledged = $${paramIndex++}`);
      params.push(filters.is_acknowledged);
    }

    const whereClause = whereConditions.join(' AND ');

    const sql = `
      SELECT bw.*, mb.batch_no, mb.material_name, mb.expiry_date
      FROM batch_warnings bw
      LEFT JOIN material_batches mb ON bw.batch_id = mb.id
      WHERE ${whereClause}
      ORDER BY bw.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM batch_warnings bw WHERE ${whereClause}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      query(this.pool, sql, params),
      query(this.pool, countSql, countParams)
    ]);

    return {
      warnings: result.rows,
      total: countResult.rows[0].count
    };
  }

  async acknowledgeWarning(warningId, userId) {
    const sql = `
      UPDATE batch_warnings
      SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(this.pool, sql, [userId, warningId]);
    return result.rows[0];
  }

  async generateExpiryWarnings() {
    const checkSql = `
      SELECT 
        id,
        batch_no,
        material_name,
        expiry_date,
        (expiry_date - CURRENT_DATE) as days_to_expiry
      FROM material_batches
      WHERE expiry_date IS NOT NULL 
        AND status = 'INSTOCK'
        AND (expiry_date - CURRENT_DATE) <= 30
        AND (expiry_date - CURRENT_DATE) >= -365
    `;
    const result = await query(this.pool, checkSql);
    
    const warningsCreated = [];
    for (const batch of result.rows) {
      let warningLevel = 'NOTICE';
      let message = '';
      
      if (batch.days_to_expiry <= 0) {
        warningLevel = 'CRITICAL';
        message = `批次 ${batch.batch_no} (${batch.material_name}) 已过期 ${Math.abs(batch.days_to_expiry)} 天`;
      } else if (batch.days_to_expiry <= 7) {
        warningLevel = 'CRITICAL';
        message = `批次 ${batch.batch_no} (${batch.material_name}) 将在 ${batch.days_to_expiry} 天后过期`;
      } else if (batch.days_to_expiry <= 30) {
        warningLevel = 'WARNING';
        message = `批次 ${batch.batch_no} (${batch.material_name}) 将在 ${batch.days_to_expiry} 天后过期`;
      }

      const existsSql = `
        SELECT 1 FROM batch_warnings 
        WHERE batch_id = $1 AND warning_type = 'EXPIRY' 
          AND created_at >= CURRENT_DATE AND is_acknowledged = false
      `;
      const existsResult = await query(this.pool, existsSql, [batch.id]);
      
      if (existsResult.rows.length === 0 && message) {
        const warning = await this.createWarning({
          batch_id: batch.id,
          warning_type: 'EXPIRY',
          warning_level: warningLevel,
          warning_message: message,
          threshold_value: 30,
          current_value: batch.days_to_expiry
        });
        warningsCreated.push(warning);
      }
    }
    return warningsCreated;
  }

  async createOriginProcessRelation(relationData) {
    const sql = `
      INSERT INTO origin_process_relations (
        material_id, origin_province, origin_city, process_type,
        process_description, process_parameters, quality_standards,
        typical_cycle_days, is_recommended, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      relationData.material_id, relationData.origin_province,
      relationData.origin_city, relationData.process_type,
      relationData.process_description,
      relationData.process_parameters ? JSON.stringify(relationData.process_parameters) : null,
      relationData.quality_standards ? JSON.stringify(relationData.quality_standards) : null,
      relationData.typical_cycle_days,
      relationData.is_recommended !== false,
      relationData.created_by
    ]);
    return result.rows[0];
  }

  async getOriginProcessRelations(filters = {}) {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.material_id) {
      whereConditions.push(`material_id = $${paramIndex++}`);
      params.push(filters.material_id);
    }

    if (filters.origin_province) {
      whereConditions.push(`origin_province = $${paramIndex++}`);
      params.push(filters.origin_province);
    }

    if (filters.origin_city) {
      whereConditions.push(`origin_city = $${paramIndex++}`);
      params.push(filters.origin_city);
    }

    if (filters.process_type) {
      whereConditions.push(`process_type = $${paramIndex++}`);
      params.push(filters.process_type);
    }

    if (filters.is_recommended !== undefined) {
      whereConditions.push(`is_recommended = $${paramIndex++}`);
      params.push(filters.is_recommended);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT opr.*, m.name as material_name, m.code as material_code
      FROM origin_process_relations opr
      LEFT JOIN materials m ON opr.material_id = m.id
      ${whereClause}
      ORDER BY opr.created_at DESC
    `;

    const result = await query(this.pool, sql, params);
    return result.rows;
  }

  async getRecommendedProcesses(originProvince, originCity, materialId = null) {
    let whereConditions = ['is_recommended = true'];
    let params = [];
    let paramIndex = 1;

    if (originProvince) {
      whereConditions.push(`origin_province = $${paramIndex++}`);
      params.push(originProvince);
    }

    if (originCity) {
      whereConditions.push(`origin_city = $${paramIndex++}`);
      params.push(originCity);
    }

    if (materialId) {
      whereConditions.push(`material_id = $${paramIndex++}`);
      params.push(materialId);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const sql = `
      SELECT opr.*, m.name as material_name
      FROM origin_process_relations opr
      LEFT JOIN materials m ON opr.material_id = m.id
      ${whereClause}
      ORDER BY opr.created_at DESC
    `;

    const result = await query(this.pool, sql, params);
    return result.rows;
  }

  async updateOriginProcessRelation(id, relationData) {
    const sql = `
      UPDATE origin_process_relations
      SET process_type = $1, process_description = $2, process_parameters = $3,
          quality_standards = $4, typical_cycle_days = $5, is_recommended = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      relationData.process_type, relationData.process_description,
      relationData.process_parameters ? JSON.stringify(relationData.process_parameters) : null,
      relationData.quality_standards ? JSON.stringify(relationData.quality_standards) : null,
      relationData.typical_cycle_days, relationData.is_recommended, id
    ]);
    return result.rows[0];
  }

  async deleteOriginProcessRelation(id) {
    const sql = 'DELETE FROM origin_process_relations WHERE id = $1 RETURNING *';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async getProcessStatistics() {
    const sql = `
      SELECT 
        origin_province,
        process_type,
        COUNT(*) as relation_count,
        AVG(typical_cycle_days) as avg_cycle_days,
        SUM(CASE WHEN is_recommended THEN 1 ELSE 0 END) as recommended_count
      FROM origin_process_relations
      GROUP BY origin_province, process_type
      ORDER BY origin_province, relation_count DESC
    `;
    const result = await query(this.pool, sql);
    return result.rows;
  }
}

module.exports = Batch;
