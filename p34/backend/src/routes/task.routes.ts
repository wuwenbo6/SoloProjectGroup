import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  assignTask,
  startTask,
  submitTask,
  requestReview,
  reviewTask,
  completeTask,
  cancelTask,
  deleteTask,
  addComment,
  getTaskComments,
  getMyTasks,
  getStatistics,
  getReviewerTasks,
  getTaskSubmissions,
} from '../controllers/TaskController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', (req, res) => createTask(req, res));
router.get('/', (req, res) => getTasks(req, res));
router.get('/statistics', (req, res) => getStatistics(req, res));
router.get('/me', (req, res) => getMyTasks(req, res));
router.get('/reviewer', (req, res) => getReviewerTasks(req, res));
router.get('/:id', (req, res) => getTaskById(req, res));
router.put('/:id', (req, res) => updateTask(req, res));
router.delete('/:id', (req, res) => deleteTask(req, res));
router.post('/:id/assign', (req, res) => assignTask(req, res));
router.post('/:id/start', (req, res) => startTask(req, res));
router.post('/:id/submit', (req, res) => submitTask(req, res));
router.post('/:id/review-request', (req, res) => requestReview(req, res));
router.post('/:id/review', (req, res) => reviewTask(req, res));
router.post('/:id/complete', (req, res) => completeTask(req, res));
router.post('/:id/cancel', (req, res) => cancelTask(req, res));
router.get('/:id/submissions', (req, res) => getTaskSubmissions(req, res));
router.get('/:id/comments', (req, res) => getTaskComments(req, res));
router.post('/:id/comments', (req, res) => addComment(req, res));

export default router;
