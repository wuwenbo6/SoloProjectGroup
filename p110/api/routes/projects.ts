import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { allQuery, runQuery } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const projects = allQuery(`
    SELECT p.*, 
           COUNT(DISTINCT i.id) as imageCount,
           COUNT(DISTINCT pm.id) as memberCount
    FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id
    LEFT JOIN images i ON p.id = i.project_id
    WHERE pm.user_id = ? OR p.created_by = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [userId, userId]);

  res.json(projects);
});

router.get('/:id', (req: AuthRequest, res) => {
  const projects = allQuery('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  
  if (projects.length === 0) {
    return res.status(404).json({ error: '项目不存在' });
  }

  res.json(projects[0]);
});

router.post('/', (req: AuthRequest, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: '项目名称不能为空' });
  }

  const projectId = uuidv4();
  const now = new Date().toISOString();

  runQuery(
    'INSERT INTO projects (id, name, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, name, description || null, req.user!.id, now, now]
  );

  runQuery(
    'INSERT INTO project_members (id, project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), projectId, req.user!.id, 'admin', now]
  );

  const projects = allQuery('SELECT * FROM projects WHERE id = ?', [projectId]);
  res.status(201).json(projects[0]);
});

router.get('/:id/members', (req, res) => {
  const members = allQuery(`
    SELECT pm.*, u.username, u.avatar
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `, [req.params.id]);

  res.json(members);
});

export default router;
