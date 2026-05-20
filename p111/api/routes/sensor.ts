import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

router.get('/current', (req: Request, res: Response) => {
  const data = dataService.getCurrentData();
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ message: 'No data available' });
  }
});

router.get('/history', (req: Request, res: Response) => {
  const { startTime, endTime } = req.query;
  const start = startTime ? new Date(startTime as string) : undefined;
  const end = endTime ? new Date(endTime as string) : undefined;

  const history = dataService.getHistoryData(start, end);
  res.json(history);
});

router.post('/simulate-anomaly/:type', (req: Request, res: Response) => {
  const { type } = req.params;
  if (type === 'temperature' || type === 'humidity' || type === 'oxygen') {
    dataService.simulateAnomaly(type);
    res.json({ message: `Anomaly simulation started for ${type}` });
  } else {
    res.status(400).json({ message: 'Invalid type' });
  }
});

export default router;
