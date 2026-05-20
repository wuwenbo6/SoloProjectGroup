import { Router } from 'express';
import {
  getStorageStats,
  getMaterialStorageInfo,
  runLifecycle,
  promoteMaterial,
  deleteMaterialStorage,
} from '../controllers/StorageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/stats', (req, res) => getStorageStats(req, res));
router.get('/:materialId', (req, res) => getMaterialStorageInfo(req, res));
router.post('/lifecycle/run', (req, res) => runLifecycle(req, res));
router.post('/promote', (req, res) => promoteMaterial(req, res));
router.delete('/:materialId', (req, res) => deleteMaterialStorage(req, res));

export default router;
