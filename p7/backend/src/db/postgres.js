import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const pool = new Pool(config.postgres);

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
});

export const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id UUID PRIMARY KEY,
      document_id UUID REFERENCES documents(id),
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS operations (
      id UUID PRIMARY KEY,
      document_id UUID REFERENCES documents(id),
      user_id UUID NOT NULL,
      operation JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      document_id UUID REFERENCES documents(id),
      user_id UUID NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      action_data JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
  `);

  console.log('Database tables initialized');
};

export default pool;
