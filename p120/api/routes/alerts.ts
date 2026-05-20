
import express from 'express';
import db from '../db';
import type { AlertRecord, AlertConfig } from '../../shared/types';

const router = express.Router();

router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const sensorType = req.query.sensorType as string;

    let query = 'SELECT * FROM alert_records';
    const params: any[] = [];

    if (sensorType) {
        query += ' WHERE sensor_type = ?';
        params.push(sensorType);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const data = db.prepare(query).all(...params) as AlertRecord[];
    res.json(data);
});

router.get('/config', (req, res) => {
    const configs = db.prepare('SELECT * FROM alert_config').all() as AlertConfig[];
    res.json(configs);
});

router.put('/config/:sensorType', (req, res) => {
    const { sensorType } = req.params;
    const { min_threshold, max_threshold, enabled } = req.body;

    const stmt = db.prepare(`
        UPDATE alert_config
        SET min_threshold = ?, max_threshold = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE sensor_type = ?
    `);
    stmt.run(min_threshold, max_threshold, enabled ? 1 : 0, sensorType);

    const updated = db.prepare('SELECT * FROM alert_config WHERE sensor_type = ?').get(sensorType) as AlertConfig;
    res.json(updated);
});

router.get('/stats', (req, res) => {
    const stats = db.prepare(`
        SELECT
            sensor_type,
            alert_type,
            COUNT(*) as count
        FROM alert_records
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY sensor_type, alert_type
    `).all();
    res.json(stats);
});

export default router;

