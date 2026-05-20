const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rubbingController = require('../controllers/rubbingController');
const imageController = require('../controllers/imageController');
const { auth, checkPermission, checkRubbingAccess, ROLES } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'rubbing-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

router.post('/', 
  auth, 
  checkPermission('CREATE_RUBBING'), 
  upload.single('image'), 
  rubbingController.createRubbing
);

router.get('/', 
  auth, 
  checkPermission('VIEW_RUBBING'), 
  rubbingController.getRubbings
);

router.get('/:id', 
  auth, 
  checkPermission('VIEW_RUBBING'), 
  checkRubbingAccess('view'),
  rubbingController.getRubbingById
);

router.put('/:id', 
  auth, 
  checkPermission('EDIT_RUBBING'), 
  checkRubbingAccess('edit'),
  rubbingController.updateRubbing
);

router.delete('/:id', 
  auth, 
  checkPermission('DELETE_RUBBING'), 
  checkRubbingAccess('delete'),
  rubbingController.deleteRubbing
);

router.post('/:id/collaborators', 
  auth, 
  checkPermission('MANAGE_COLLABORATORS'), 
  checkRubbingAccess('manage'),
  rubbingController.addCollaborator
);

router.delete('/:id/collaborators/:userId', 
  auth, 
  checkPermission('MANAGE_COLLABORATORS'), 
  checkRubbingAccess('manage'),
  rubbingController.removeCollaborator
);

router.put('/:id/characters', 
  auth, 
  checkPermission('INTERPRET_CHARACTER'), 
  checkRubbingAccess('edit'),
  rubbingController.updateCharacter
);

router.put('/:id/characters/:charId/confirm', 
  auth, 
  checkPermission('CONFIRM_INTERPRETATION'), 
  checkRubbingAccess('edit'),
  rubbingController.confirmCharacter
);

router.get('/:id/history', 
  auth, 
  checkPermission('VIEW_RUBBING'),
  checkRubbingAccess('view'),
  rubbingController.getInterpretationHistory
);

router.post('/:id/process', 
  auth, 
  checkPermission('EDIT_RUBBING'),
  checkRubbingAccess('edit'),
  imageController.processImage
);

router.post('/:id/auto-preprocess', 
  auth, 
  checkPermission('EDIT_RUBBING'),
  checkRubbingAccess('edit'),
  imageController.autoPreprocess
);

router.post('/:id/recognize', 
  auth, 
  checkPermission('EDIT_RUBBING'),
  checkRubbingAccess('edit'),
  imageController.recognizeCharacters
);

router.get('/:id/characters/:charId/image', 
  auth, 
  checkPermission('VIEW_RUBBING'),
  checkRubbingAccess('view'),
  imageController.getCharacterImage
);

router.get('/:id/quality', 
  auth, 
  checkPermission('VIEW_RUBBING'),
  checkRubbingAccess('view'),
  imageController.analyzeQuality
);

router.post('/:id/repair', 
  auth, 
  checkPermission('EDIT_RUBBING'),
  checkRubbingAccess('edit'),
  imageController.repairImage
);

router.post('/:id/export', 
  auth, 
  checkPermission('VIEW_RUBBING'),
  checkRubbingAccess('view'),
  imageController.exportRubbing
);

router.get('/export/formats', 
  auth, 
  imageController.getExportFormats
);

router.get('/dictionary/lookup/:char', 
  auth, 
  imageController.lookupCharacter
);

router.get('/dictionary/search', 
  auth, 
  imageController.searchDictionary
);

router.get('/dictionary/stats', 
  auth, 
  imageController.getDictionaryStats
);

module.exports = router;
