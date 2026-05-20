import { Router } from 'express';
import {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getCategories,
} from './controllers/materialController';
import {
  createProcess,
  getProcesses,
  getProcessById,
  updateProcess,
  deleteProcess,
  mapMaterialToProcess,
  unmapMaterialFromProcess,
  getProcessMaterials,
  getMaterialProcesses,
  getProcessesByOrigin,
} from './controllers/processController';
import { authenticateToken, requireRoles } from '../../shared/middleware/auth';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'material' }));

router.use(authenticateToken);

router.get('/', getMaterials);
router.get('/categories', getCategories);
router.get('/:id', getMaterialById);
router.post('/', requireRoles('material_manager', 'admin'), createMaterial);
router.put('/:id', requireRoles('material_manager', 'admin'), updateMaterial);
router.delete('/:id', requireRoles('material_manager', 'admin'), deleteMaterial);

router.get('/:materialId/processes', getMaterialProcesses);

router.get('/processes', getProcesses);
router.post('/processes', requireRoles('material_manager', 'admin'), createProcess);
router.get('/processes/origin/:origin', getProcessesByOrigin);
router.get('/processes/:id', getProcessById);
router.put('/processes/:id', requireRoles('material_manager', 'admin'), updateProcess);
router.delete('/processes/:id', requireRoles('material_manager', 'admin'), deleteProcess);
router.get('/processes/:processId/materials', getProcessMaterials);
router.post('/processes/:processId/materials', requireRoles('material_manager', 'admin'), mapMaterialToProcess);
router.delete('/processes/:processId/materials/:materialId', requireRoles('material_manager', 'admin'), unmapMaterialFromProcess);

export default router;
