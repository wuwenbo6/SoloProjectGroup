import { Router } from 'express';
import { PatternController } from '../controllers/PatternController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const patternController = new PatternController();

router.get('/', (req, res) => patternController.getPatterns(req, res));
router.get('/stats', (req, res) => patternController.getStats(req, res));
router.get('/:id', (req, res) => patternController.getPatternById(req, res));

router.use(authenticateToken);
router.post('/generate', (req, res) => patternController.generatePattern(req, res));
router.get('/me/list', (req, res) => patternController.getMyPatterns(req, res));
router.put('/:id', (req, res) => patternController.updatePattern(req, res));
router.delete('/:id', (req, res) => patternController.deletePattern(req, res));

export default router;
