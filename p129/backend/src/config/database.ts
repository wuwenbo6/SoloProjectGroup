import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'particle_life',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS particle_stats (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_particles INTEGER NOT NULL,
        foraging_particles INTEGER NOT NULL,
        attacking_particles INTEGER NOT NULL,
        reproducing_particles INTEGER NOT NULL,
        sleeping_particles INTEGER NOT NULL DEFAULT 0,
        average_energy FLOAT NOT NULL DEFAULT 0,
        avg_speed FLOAT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS particle_history (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        particle_id VARCHAR(255) NOT NULL,
        state VARCHAR(50) NOT NULL,
        position_x FLOAT NOT NULL,
        position_y FLOAT NOT NULL,
        position_z FLOAT NOT NULL,
        energy FLOAT NOT NULL DEFAULT 100
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_particle_history_timestamp 
      ON particle_history(timestamp)
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}
