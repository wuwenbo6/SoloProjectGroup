import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { ThresholdConfig } from '../../shared/types';

const router = Router();

router.get('/thresholds', (req: Request, res: Response) => {
  const thresholds = dataService.getThresholds();
  res.json(thresholds);
});

router.put('/thresholds', (req: Request, res: Response) => {
  const config = req.body as Partial<ThresholdConfig>;
  const updated = dataService.updateThresholds(config);
  res.json(updated);
});

export default router;
