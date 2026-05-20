import express from 'express';
import db from '../db';
import { predictQuality, getParameterRecommendations, analyzeAnomaly, getBatchData } from '../aiPredictor';

const router = express.Router();

router.get('/quality-prediction', (req, res) => {
    try {
        const latestData = db.prepare('SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1').get() as any;
        
        if (!latestData) {
            return res.status(404).json({ error: '暂无传感器数据' });
        }

        const prediction = predictQuality(latestData);
        res.json({ ...prediction, sensorData: latestData });
    } catch (error) {
        console.error('Quality prediction error:', error);
        res.status(500).json({ error: '预测失败' });
    }
});

router.get('/parameter-recommendations', (req, res) => {
    try {
        const latestData = db.prepare('SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1').get() as any;
        
        if (!latestData) {
            return res.status(404).json({ error: '暂无传感器数据' });
        }

        const recommendations = getParameterRecommendations(latestData);
        res.json(recommendations);
    } catch (error) {
        console.error('Parameter recommendation error:', error);
        res.status(500).json({ error: '获取推荐失败' });
    }
});

router.get('/anomaly-analysis/:alertType', (req, res) => {
    try {
        const { alertType } = req.params;
        const latestData = db.prepare('SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1').get() as any;
        
        const analysis = analyzeAnomaly(latestData || {}, alertType);
        res.json(analysis);
    } catch (error) {
        console.error('Anomaly analysis error:', error);
        res.status(500).json({ error: '分析失败' });
    }
});

router.get('/batch-comparison', (req, res) => {
    try {
        const batches = getBatchData();
        res.json(batches);
    } catch (error) {
        console.error('Batch comparison error:', error);
        res.status(500).json({ error: '获取批次数据失败' });
    }
});

export default router;
