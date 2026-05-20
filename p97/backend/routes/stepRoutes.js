const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { activityDb, interactionDb, userDb } = require('../config/database');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.post('/:activityId/steps', upload.single('image'), (req, res) => {
  const { activityId } = req.params;
  const { stepNumber, title, description } = req.body;
  const id = uuidv4();
  const image = req.file ? '/uploads/' + req.file.filename : null;

  activityDb.run(
    'INSERT INTO activity_steps (id, activity_id, step_number, title, description, image) VALUES (?, ?, ?, ?, ?, ?)',
    [id, activityId, parseInt(stepNumber), title, description, image],
    (err) => {
      if (err) {
        console.error('创建步骤失败:', err);
        return res.status(500).json({ error: '创建步骤失败' });
      }
      res.status(201).json({ id, message: '步骤创建成功' });
    }
  );
});

router.get('/:activityId/steps', (req, res) => {
  const { activityId } = req.params;
  
  activityDb.all('SELECT * FROM activity_steps WHERE activity_id = ? ORDER BY step_number ASC', [activityId], async (err, steps) => {
    if (err) {
      console.error('获取步骤失败:', err);
      return res.status(500).json({ error: '获取步骤失败' });
    }
    
    const stepsWithQA = await Promise.all(steps.map(async (step) => {
      return new Promise((resolve) => {
        interactionDb.all('SELECT * FROM step_qa WHERE step_id = ? ORDER BY created_at DESC', [step.id], async (err, qas) => {
          if (err) {
            step.qa = [];
          } else {
            const qaWithUsers = await Promise.all(qas.map(async (qa) => {
              return new Promise((resolveQA) => {
                userDb.get('SELECT id, username FROM users WHERE id = ?', [qa.user_id], (err, user) => {
                  qa.user = user || { username: '未知用户' };
                  if (qa.answer_user_id) {
                    userDb.get('SELECT id, username FROM users WHERE id = ?', [qa.answer_user_id], (err, answerUser) => {
                      qa.answerUser = answerUser || { username: '未知用户' };
                      resolveQA(qa);
                    });
                  } else {
                    resolveQA(qa);
                  }
                });
              });
            }));
            step.qa = qaWithUsers;
          }
          resolve(step);
        });
      });
    }));
    
    res.json(stepsWithQA);
  });
});

router.put('/steps/:stepId', upload.single('image'), (req, res) => {
  const { stepId } = req.params;
  const { stepNumber, title, description } = req.body;
  
  let updateSql = 'UPDATE activity_steps SET step_number = ?, title = ?, description = ?';
  let params = [parseInt(stepNumber), title, description];
  
  if (req.file) {
    updateSql += ', image = ?';
    params.push('/uploads/' + req.file.filename);
  }
  
  updateSql += ' WHERE id = ?';
  params.push(stepId);
  
  activityDb.run(updateSql, params, function(err) {
    if (err) {
      console.error('更新步骤失败:', err);
      return res.status(500).json({ error: '更新步骤失败' });
    }
    if (this.changes === 0) return res.status(404).json({ error: '步骤不存在' });
    res.json({ message: '步骤更新成功' });
  });
});

router.delete('/steps/:stepId', (req, res) => {
  const { stepId } = req.params;
  
  activityDb.run('DELETE FROM activity_steps WHERE id = ?', [stepId], function(err) {
    if (err) {
      console.error('删除步骤失败:', err);
      return res.status(500).json({ error: '删除步骤失败' });
    }
    interactionDb.run('DELETE FROM step_qa WHERE step_id = ?', [stepId]);
    res.json({ message: '步骤删除成功' });
  });
});

router.post('/steps/:stepId/qa', (req, res) => {
  const { stepId } = req.params;
  const { activityId, userId, question } = req.body;
  const id = uuidv4();

  interactionDb.run(
    'INSERT INTO step_qa (id, step_id, activity_id, user_id, question) VALUES (?, ?, ?, ?, ?)',
    [id, stepId, activityId, userId, question],
    (err) => {
      if (err) {
        console.error('提问失败:', err);
        return res.status(500).json({ error: '提问失败' });
      }
      res.status(201).json({ id, message: '提问成功' });
    }
  );
});

router.post('/qa/:qaId/answer', (req, res) => {
  const { qaId } = req.params;
  const { answer, userId } = req.body;
  const answeredAt = new Date().toISOString();

  interactionDb.run(
    'UPDATE step_qa SET answer = ?, answer_user_id = ?, answered_at = ? WHERE id = ?',
    [answer, userId, answeredAt, qaId],
    function(err) {
      if (err) {
        console.error('回答失败:', err);
        return res.status(500).json({ error: '回答失败' });
      }
      if (this.changes === 0) return res.status(404).json({ error: '问题不存在' });
      res.json({ message: '回答成功' });
    }
  );
});

router.delete('/qa/:qaId', (req, res) => {
  const { qaId } = req.params;
  
  interactionDb.run('DELETE FROM step_qa WHERE id = ?', [qaId], function(err) {
    if (err) {
      console.error('删除问题失败:', err);
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
