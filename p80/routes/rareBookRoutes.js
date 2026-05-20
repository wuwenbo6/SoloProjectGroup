const express = require('express');
const router = express.Router();
const rareBookController = require('../controllers/rareBookController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/statistics', authenticate, rareBookController.getStatistics);
router.get('/code/:code', authenticate, rareBookController.getRareBookByCode);
router.get('/:id', authenticate, rareBookController.getRareBookById);
router.get('/', authenticate, rareBookController.getAllRareBooks);

router.post('/', authenticate, requireRole('admin', 'restorer'), rareBookController.createRareBook);
router.put('/:id', authenticate, requireRole('admin', 'restorer'), rareBookController.updateRareBook);
router.patch('/:id/status', authenticate, requireRole('admin', 'restorer'), rareBookController.updateStatus);
router.delete('/:id', authenticate, requireRole('admin'), rareBookController.deleteRareBook);

module.exports = router;
