
import express from 'express';
import db from '../db';
import type { SensorData } from '../../shared/types';

const router = express.Router();

router.get('/latest', (req, res) => {
    const data = db.prepare('SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1').get() as SensorData;
    res.json(data || null);
});

router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    let query = 'SELECT * FROM sensor_data';
    const params: any[] = [];

    if (startTime && endTime) {
        query += ' WHERE created_at BETWEEN ? AND ?';
        params.push(startTime, endTime);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const data = db.prepare(query).all(...params) as SensorData[];
    res.json(data);
});

router.get('/stats', (req, res) => {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    let query = `
        SELECT
            MIN(temperature) as temp_min, MAX(temperature) as temp_max, AVG(temperature) as temp_avg,
            MIN(humidity) as hum_min, MAX(humidity) as hum_max, AVG(humidity) as hum_avg,
            MIN(salinity) as sal_min, MAX(salinity) as sal_max, AVG(salinity) as sal_avg,
            MIN(ph) as ph_min, MAX(ph) as ph_max, AVG(ph) as ph_avg
        FROM sensor_data
    `;
    const params: any[] = [];

    if (startTime && endTime) {
        query += ' WHERE created_at BETWEEN ? AND ?';
        params.push(startTime, endTime);
    }

    const stats = db.prepare(query).get(...params);
    res.json(stats);
});

export default router;

