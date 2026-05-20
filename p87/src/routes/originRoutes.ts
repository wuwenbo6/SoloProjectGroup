import { Router } from 'express';
import {
  getOriginStatistics,
  getOriginCraftRelations,
  getCraftOriginUsage,
  getOriginHeatmap,
  getOriginCraftMatrix,
  searchByOriginOrCraft
} from '../controllers/originCraftController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/statistics', authenticate, getOriginStatistics);
router.get('/craft-relations/:origin', authenticate, getOriginCraftRelations);
router.get('/craft-usage/:craftId', authenticate, getCraftOriginUsage);
router.get('/heatmap', authenticate, getOriginHeatmap);
router.get('/matrix', authenticate, getOriginCraftMatrix);
router.get('/search', authenticate, searchByOriginOrCraft);

export default router;
