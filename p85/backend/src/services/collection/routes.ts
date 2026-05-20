import { Router } from 'express';
import {
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  syncCollections,
  batchCreateCollections,
  getStatistics,
  exportCollections,
} from './controllers/collectionController';
import { authenticateToken, requireRoles } from '../../shared/middleware/auth';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'collection' }));

router.use(authenticateToken);

router.get('/', getCollections);
router.get('/statistics', getStatistics);
router.get('/export', exportCollections);
router.get('/:id', getCollectionById);
router.post('/', requireRoles('collector', 'material_manager', 'admin'), createCollection);
router.post('/batch', requireRoles('collector', 'material_manager', 'admin'), batchCreateCollections);
router.put('/:id', requireRoles('collector', 'material_manager', 'admin'), updateCollection);
router.post('/sync', requireRoles('material_manager', 'admin'), syncCollections);

export default router;
