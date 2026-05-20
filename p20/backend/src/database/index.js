const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        owner_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scene_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        snapshot_data JSONB NOT NULL,
        version INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        lamport_time INTEGER DEFAULT 0,
        vector_clock JSONB,
        UNIQUE(scene_id, version)
      );

      CREATE TABLE IF NOT EXISTS scene_members (
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(scene_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_scene ON scene_snapshots(scene_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_version ON scene_snapshots(version);

      CREATE TABLE IF NOT EXISTS scene_branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id),
        parent_commit_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scene_id, name)
      );

      CREATE TABLE IF NOT EXISTS scene_commits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        branch_id UUID REFERENCES scene_branches(id) ON DELETE CASCADE,
        parent_ids UUID[] DEFAULT '{}'::UUID[],
        message VARCHAR(500),
        snapshot_data JSONB NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lamport_time INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS scene_branch_head (
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        branch_id UUID REFERENCES scene_branches(id) ON DELETE CASCADE,
        commit_id UUID REFERENCES scene_commits(id) ON DELETE CASCADE,
        PRIMARY KEY(scene_id, branch_id)
      );

      CREATE INDEX IF NOT EXISTS idx_branches_scene ON scene_branches(scene_id);
      CREATE INDEX IF NOT EXISTS idx_commits_branch ON scene_commits(branch_id);
      CREATE INDEX IF NOT EXISTS idx_commits_parent ON scene_commits USING GIN(parent_ids);
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

module.exports = { pool, initDatabase };
