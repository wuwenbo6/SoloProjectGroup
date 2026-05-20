import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { dataService } from '../services/dataService.js';

const router = Router();

// 品质预测
router.get('/quality-prediction', (req: Request, res: Response) => {
  const currentData = dataService.getCurrentData();
  if (!currentData) {
    return res.status(404).json({ message: 'No sensor data available' });
  }
  const prediction = aiService.predictQuality(currentData);
  res.json(prediction);
});

// 参数推荐
router.get('/parameter-recommendations', (req: Request, res: Response) => {
  const currentData = dataService.getCurrentData();
  if (!currentData) {
    return res.status(404).json({ message: 'No sensor data available' });
  }
  const recommendations = aiService.recommendParameters(currentData);
  res.json(recommendations);
});

// 根因分析
router.post('/root-cause-analysis', (req: Request, res: Response) => {
  const { anomalyType } = req.body;
  const currentData = dataService.getCurrentData();

  if (!currentData) {
    return res.status(404).json({ message: 'No sensor data available' });
  }

  if (!anomalyType) {
    return res.status(400).json({ message: 'anomalyType is required' });
  }

  const analysis = aiService.analyzeRootCause(currentData, anomalyType);
  res.json(analysis);
});

// 多设备数据
router.get('/devices', (req: Request, res: Response) => {
  const devices = [
    aiService.generateDeviceData('device-001', '发酵罐A'),
    aiService.generateDeviceData('device-002', '发酵罐B'),
    aiService.generateDeviceData('device-003', '发酵罐C'),
    aiService.generateDeviceData('device-004', '发酵罐D'),
  ];
  res.json(devices);
});

export default router;
