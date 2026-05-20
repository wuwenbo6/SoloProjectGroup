const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const sceneController = require('../controllers/sceneController');
const branchController = require('../controllers/branchController');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getMe);

router.post('/scenes', sceneController.createScene);
router.get('/scenes', sceneController.getScenes);
router.get('/scenes/:id', sceneController.getSceneById);
router.post('/scenes/:id/join', sceneController.joinScene);
router.delete('/scenes/:id', sceneController.deleteScene);
router.get('/scenes/:sceneId/snapshots', sceneController.getSnapshots);

router.get('/scenes/:sceneId/branches', branchController.getBranches);
router.get('/scenes/:sceneId/branches/:branchId', branchController.getBranch);
router.post('/scenes/:sceneId/branches', branchController.createBranch);
router.delete('/scenes/:sceneId/branches/:branchId', branchController.deleteBranch);
router.get('/scenes/:sceneId/branches/:branchId/stats', branchController.getBranchStats);

router.post('/scenes/:sceneId/branches/:branchId/commits', branchController.createCommit);
router.get('/scenes/:sceneId/branches/:branchId/commits', branchController.getCommitHistory);
router.get('/scenes/:sceneId/commits/:commitId', branchController.getCommit);

router.get('/scenes/:sceneId/compare/:commitAId/:commitBId', branchController.compareCommits);
router.post('/scenes/:sceneId/merge', branchController.mergeBranches);

module.exports = router;
