import { Router } from 'express';
import {
  createDataSource,
  updateDataSource,
  deleteDataSource,
  getAllDataSources,
  getDataSourceById,
  syncDataSource,
  syncAllDataSources,
  getSyncLogs,
  getStatistics,
} from '../controllers/MuseumController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', (req, res) => createDataSource(req, res));
router.get('/', (req, res) => getAllDataSources(req, res));
router.get('/statistics', (req, res) => getStatistics(req, res));
router.get('/:id', (req, res) => getDataSourceById(req, res));
router.put('/:id', (req, res) => updateDataSource(req, res));
router.delete('/:id', (req, res) => deleteDataSource(req, res));
router.post('/:id/sync', (req, res) => syncDataSource(req, res));
router.post('/sync/all', (req, res) => syncAllDataSources(req, res));
router.get('/:dataSourceId/logs', (req, res) => getSyncLogs(req, res));

export default router;
