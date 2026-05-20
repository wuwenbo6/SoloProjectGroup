const { query, transaction } = require('../../../shared/utils/db');
const crypto = require('crypto');

class QualityInspection {
  constructor(pool) {
    this.pool = pool;
  }

  generateSecureInspectionNo() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INS-${timestamp}-${random}`;
  }

  async generateInspectionNo() {
    try {
      const result = await transaction(this.pool, async (client) => {
        await client.query('LOCK TABLE quality_inspections IN EXCLUSIVE MODE');
        
        const seqResult = await client.query(
          `SELECT COALESCE(MAX(SUBSTR(inspection_no, 12)::INTEGER), 0) + 1 as next_seq 
           FROM quality_inspections 
           WHERE inspection_no LIKE 'INS' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '%'`
        );
        
        const nextSeq = seqResult.rows[0].next_seq;
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const inspectionNo = `INS${today}${nextSeq.toString().padStart(4, '0')}`;
        
        const exists = await client.query('SELECT 1 FROM quality_inspections WHERE inspection_no = $1', [inspectionNo]);
        if (exists.rows.length > 0) {
          return this.generateSecureInspectionNo();
        }
        return inspectionNo;
      });
      return result;
    } catch (err) {
      console.warn('生成检验单号失败，使用安全回退:', err.message);
      return this.generateSecureInspectionNo();
    }
  }

  roundScore(score, precision = 2) {
    const factor = Math.pow(10, precision);
    return Math.round((score + Number.EPSILON) * factor) / factor;
  }

  async calculateGrade(score) {
    const roundedScore = this.roundScore(score, 2);
    const sql = `
      SELECT * FROM quality_grades 
      WHERE min_score <= $1 AND max_score >= $1 AND is_active = true
      ORDER BY sort_order
    `;
    const result = await query(this.pool, sql, [roundedScore]);
    return result.rows[0];
  }

  async create(inspectionData) {
    const inspectionNo = inspectionData.inspection_no || await this.generateInspectionNo();
    
    let grade = null;
    let isQualified = true;
    
    if (inspectionData.total_score !== undefined) {
      const gradeResult = await this.calculateGrade(inspectionData.total_score);
      if (gradeResult) {
        grade = gradeResult.grade_code;
        isQualified = grade !== 'UNQUALIFIED';
      }
    }

    const sql = `
      INSERT INTO quality_inspections (
        batch_id, inspection_no, standard_id, inspector_id, inspector_name,
        inspection_time, inspection_items, inspection_result, total_score,
        grade, conclusion, is_qualified, remarks, attachment_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await query(this.pool, sql, [
      inspectionData.batch_id, inspectionNo, inspectionData.standard_id,
      inspectionData.inspector_id, inspectionData.inspector_name,
      inspectionData.inspection_time,
      inspectionData.inspection_items ? JSON.stringify(inspectionData.inspection_items) : null,
      inspectionData.inspection_result ? JSON.stringify(inspectionData.inspection_result) : null,
      inspectionData.total_score, grade, inspectionData.conclusion,
      isQualified, inspectionData.remarks,
      inspectionData.attachment_urls ? JSON.stringify(inspectionData.attachment_urls) : null
    ]);
    return result.rows[0];
  }

  async findByBatchId(batchId) {
    const sql = 'SELECT * FROM quality_inspections WHERE batch_id = $1 ORDER BY inspection_time DESC';
    const result = await query(this.pool, sql, [batchId]);
    return result.rows;
  }

  async findById(id) {
    const sql = 'SELECT * FROM quality_inspections WHERE id = $1';
    const result = await query(this.pool, sql, [id]);
    return result.rows[0];
  }

  async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.batch_id) {
      whereConditions.push(`batch_id = $${paramIndex++}`);
      params.push(filters.batch_id);
    }

    if (filters.grade) {
      whereConditions.push(`grade = $${paramIndex++}`);
      params.push(filters.grade);
    }

    if (filters.is_qualified !== undefined) {
      whereConditions.push(`is_qualified = $${paramIndex++}`);
      params.push(filters.is_qualified);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT * FROM quality_inspections
      ${whereClause}
      ORDER BY inspection_time DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM quality_inspections ${whereClause}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      query(this.pool, sql, params),
      query(this.pool, countSql, countParams)
    ]);

    return {
      inspections: result.rows,
      total: countResult.rows[0].count
    };
  }

  async getGrades() {
    const sql = 'SELECT * FROM quality_grades WHERE is_active = true ORDER BY sort_order';
    const result = await query(this.pool, sql);
    return result.rows;
  }
}

module.exports = QualityInspection;
