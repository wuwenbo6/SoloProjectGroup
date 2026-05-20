const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { activityDb, userDb, interactionDb } = require('../config/database');

function safeJSONParse(str, fallback = []) {
  try {
    return JSON.parse(str || '[]');
  } catch (e) {
    return fallback;
  }
}

module.exports = (upload) => {
  const router = express.Router();

  const uploadFiles = upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]);

  router.post('/', (req, res) => {
    uploadFiles(req, res, (err) => {
      if (err) {
        console.error('文件上传错误:', err);
        return res.status(400).json({ error: err.message || '文件上传失败' });
      }

      const { userId, title, description, location, date, category } = req.body;
      
      if (!userId || !title) {
        return res.status(400).json({ error: '用户ID和标题为必填项' });
      }

      const id = uuidv4();
      const images = req.files && req.files.images 
        ? JSON.stringify(req.files.images.map(f => '/uploads/' + f.filename)) 
        : JSON.stringify([]);
      const videos = req.files && req.files.videos
        ? JSON.stringify(req.files.videos.map(f => '/uploads/' + f.filename))
        : JSON.stringify([]);

      activityDb.run(
        'INSERT INTO activities (id, user_id, title, description, location, date, images, videos, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, userId, title, description || '', location || '', date || '', images, videos, category || '其他'],
        function(err) {
          if (err) {
            console.error('创建活动失败:', err);
            return res.status(500).json({ error: '创建活动失败，请重试' });
          }
          res.status(201).json({ id, message: '活动创建成功' });
        }
      );
    });
  });

  router.get('/', (req, res) => {
    const { userId, category } = req.query;
    let query = 'SELECT * FROM activities';
    let params = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    } else if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY created_at DESC';

    activityDb.all(query, params, async (err, activities) => {
      if (err) {
        console.error('查询活动失败:', err);
        return res.status(500).json({ error: '查询失败，请重试' });
      }

      const userCache = new Map();
      
      const activitiesWithUser = await Promise.all(activities.map(async (activity) => {
        return new Promise((resolve) => {
          if (userCache.has(activity.user_id)) {
            activity.user = userCache.get(activity.user_id);
            activity.images = safeJSONParse(activity.images);
            activity.videos = safeJSONParse(activity.videos);
            resolve(activity);
          } else {
            userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [activity.user_id], (err, user) => {
              const userData = user || { id: activity.user_id, username: '未知用户' };
              userCache.set(activity.user_id, userData);
              activity.user = userData;
              activity.images = safeJSONParse(activity.images);
              activity.videos = safeJSONParse(activity.videos);
              resolve(activity);
            });
          }
        });
      }));

      res.json(activitiesWithUser);
    });
  });

  router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    activityDb.get('SELECT * FROM activities WHERE id = ?', [id], (err, activity) => {
      if (err) {
        console.error('查询活动详情失败:', err);
        return res.status(500).json({ error: '查询失败，请重试' });
      }
      if (!activity) return res.status(404).json({ error: '活动不存在' });

      activity.images = safeJSONParse(activity.images);
      activity.videos = safeJSONParse(activity.videos);
      
      activityDb.run('UPDATE activities SET view_count = view_count + 1 WHERE id = ?', [id]);

      userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [activity.user_id], (err, user) => {
        activity.user = user || { id: activity.user_id, username: '未知用户' };
        
        interactionDb.all('SELECT * FROM comments WHERE activity_id = ? ORDER BY created_at DESC', [id], async (err, comments) => {
          if (err) {
            console.error('查询评论失败:', err);
            activity.comments = [];
          } else {
            const commentsWithUser = await Promise.all(comments.map(async (comment) => {
              return new Promise((resolve) => {
                userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [comment.user_id], (err, user) => {
                  comment.user = user || { id: comment.user_id, username: '未知用户' };
                  resolve(comment);
                });
              });
            }));
            activity.comments = commentsWithUser;
          }
          res.json(activity);
        });
      });
    });
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    activityDb.run('DELETE FROM activities WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: '删除失败' });
      if (this.changes === 0) return res.status(404).json({ error: '活动不存在' });
      res.json({ message: '删除成功' });
    });
  });

  return router;
};
