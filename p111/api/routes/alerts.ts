import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const alerts = dataService.getAlerts(limit);
  res.json(alerts);
});

router.put('/:id/acknowledge', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = dataService.acknowledgeAlert(id);
  if (success) {
    res.json({ message: 'Alert acknowledged' });
  } else {
    res.status(404).json({ message: 'Alert not found' });
  }
});

export default router;
