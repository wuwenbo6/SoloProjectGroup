import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { getParticleStats } from '../services/websocket';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const realtimeStats = getParticleStats();
    
    const result = await pool.query(
      'SELECT * FROM particle_stats ORDER BY timestamp DESC LIMIT 1'
    );
    
    res.json({
      realtime: realtimeStats,
      latest: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await pool.query(
      'SELECT * FROM particle_stats ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    res.json({
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/particle-history', async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const particleId = req.query.particleId as string;
    
    let query = 'SELECT * FROM particle_history WHERE 1=1';
    const params: any[] = [];
    
    if (startTime) {
      params.push(new Date(startTime));
      query += ` AND timestamp >= $${params.length}`;
    }
    
    if (endTime) {
      params.push(new Date(endTime));
      query += ` AND timestamp <= $${params.length}`;
    }
    
    if (particleId) {
      params.push(particleId);
      query += ` AND particle_id = $${params.length}`;
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 1000';
    
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Error getting particle history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/stats', async (req: Request, res: Response) => {
  try {
    const { total_particles, foraging_particles, attacking_particles, reproducing_particles, sleeping_particles, average_energy, avg_speed } = req.body;
    
    const result = await pool.query(
      `INSERT INTO particle_stats 
       (total_particles, foraging_particles, attacking_particles, reproducing_particles, sleeping_particles, average_energy, avg_speed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [total_particles, foraging_particles, attacking_particles, reproducing_particles, sleeping_particles || 0, average_energy || 0, avg_speed]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/particle-history', async (req: Request, res: Response) => {
  try {
    const particles = req.body.particles || [];
    
    if (particles.length === 0) {
      return res.status(400).json({ error: 'No particles provided' });
    }
    
    const values = particles.map((p: any, i: number) => {
      const base = i * 6;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    }).join(', ');
    
    const params = particles.flatMap((p: any) => [
      p.id,
      p.state,
      p.position.x,
      p.position.y,
      p.position.z,
      p.energy || 100,
    ]);
    
    await pool.query(
      `INSERT INTO particle_history 
       (particle_id, state, position_x, position_y, position_z, energy)
       VALUES ${values}`,
      params
    );
    
    res.status(201).json({ success: true, count: particles.length });
  } catch (error) {
    console.error('Error saving particle history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
