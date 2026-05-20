import { v4 as uuidv4 } from 'uuid';
import pool from '../db/postgres.js';
import redis from '../db/redis.js';

export const createDocument = async (name, initialContent = '') => {
  const id = uuidv4();
  await pool.query(
    'INSERT INTO documents (id, name) VALUES ($1, $2)',
    [id, name]
  );
  await createSnapshot(id, initialContent, 1);
  await redis.set(`document:${id}:content`, initialContent);
  await redis.set(`document:${id}:version`, 1);
  return { id, name };
};

export const getDocument = async (id) => {
  const result = await pool.query(
    'SELECT * FROM documents WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const createSnapshot = async (documentId, content, version) => {
  const id = uuidv4();
  await pool.query(
    'INSERT INTO snapshots (id, document_id, content, version) VALUES ($1, $2, $3, $4)',
    [id, documentId, content, version]
  );
};

export const getLatestSnapshot = async (documentId) => {
  const result = await pool.query(
    'SELECT * FROM snapshots WHERE document_id = $1 ORDER BY version DESC LIMIT 1',
    [documentId]
  );
  return result.rows[0];
};

export const getSnapshots = async (documentId) => {
  const result = await pool.query(
    'SELECT * FROM snapshots WHERE document_id = $1 ORDER BY version DESC',
    [documentId]
  );
  return result.rows;
};

export const revertToSnapshot = async (documentId, snapshotId) => {
  const snapshotResult = await pool.query(
    'SELECT content, version FROM snapshots WHERE id = $1 AND document_id = $2',
    [snapshotId, documentId]
  );
  
  if (snapshotResult.rows.length === 0) {
    throw new Error('Snapshot not found');
  }

  const { content, version } = snapshotResult.rows[0];
  await redis.set(`document:${documentId}:content`, content);
  await redis.set(`document:${documentId}:version`, version);
  
  return { content, version };
};

export const saveOperation = async (documentId, userId, operation) => {
  const id = uuidv4();
  await pool.query(
    'INSERT INTO operations (id, document_id, user_id, operation) VALUES ($1, $2, $3, $4)',
    [id, documentId, userId, JSON.stringify(operation)]
  );
};
