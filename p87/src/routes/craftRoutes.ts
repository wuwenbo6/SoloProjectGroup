import { Router } from 'express';
import { createCraft, getCraftList, getCraftDetail, updateCraft, deleteCraft } from '../controllers/craftController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('admin', 'artisan'), createCraft);
router.get('/', authenticate, getCraftList);
router.get('/:craftId', authenticate, getCraftDetail);
router.put('/:craftId', authenticate, authorize('admin', 'artisan'), updateCraft);
router.delete('/:craftId', authenticate, authorize('admin'), deleteCraft);

export default router;
