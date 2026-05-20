import { v4 as uuidv4 } from 'uuid';
import pool from '../db/postgres.js';
import batchWriter from './batchWriter.js';
import { writePoint } from '../db/influxdb.js';

const ACTION_TYPES = {
  DOCUMENT_OPEN: 'document_open',
  DOCUMENT_CLOSE: 'document_close',
  EDIT: 'edit',
  CURSOR_MOVE: 'cursor_move',
  SNAPSHOT_CREATE: 'snapshot_create',
  SNAPSHOT_REVERT: 'snapshot_revert',
  CONNECTION: 'connection',
  DISCONNECTION: 'disconnection',
};

export const logAction = async (documentId, userId, userName, actionType, actionData = null, ipAddress = null, userAgent = null) => {
  const logEntry = {
    id: uuidv4(),
    document_id: documentId,
    user_id: userId,
    user_name: userName,
    action_type: actionType,
    action_data: actionData ? JSON.stringify(actionData) : null,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: new Date(),
  };

  await batchWriter.enqueue('audit_logs', logEntry);

  writePoint('user_actions', {
    count: 1,
    documentId,
    userId,
    actionType,
  }, {
    action_type: actionType,
    document_id: documentId,
    user_id: userId,
  });
};

export const getAuditLogs = async (documentId, options = {}) => {
  const { userId, actionType, startTime, endTime, limit = 100, offset = 0 } = options;
  
  let query = `
    SELECT * FROM audit_logs 
    WHERE document_id = $1
  `;
  const params = [documentId];
  let paramIndex = 2;

  if (userId) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  if (actionType) {
    query += ` AND action_type = $${paramIndex}`;
    params.push(actionType);
    paramIndex++;
  }

  if (startTime) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(startTime);
    paramIndex++;
  }

  if (endTime) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(endTime);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

export const getAuditStats = async (documentId) => {
  const result = await pool.query(`
    SELECT 
      action_type,
      user_id,
      user_name,
      COUNT(*) as count,
      DATE_TRUNC('hour', created_at) as hour
    FROM audit_logs 
    WHERE document_id = $1
    GROUP BY action_type, user_id, user_name, DATE_TRUNC('hour', created_at)
    ORDER BY hour DESC
    LIMIT 500
  `, [documentId]);

  return result.rows;
};

export const flushAllLogs = async () => {
  const promises = [];
  for (const documentId of logBuffer.keys()) {
    promises.push(flushLogs(documentId));
  }
  await Promise.all(promises);
};

export { ACTION_TYPES };
