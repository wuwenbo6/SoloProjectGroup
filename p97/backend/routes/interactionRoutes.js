const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { interactionDb, userDb, activityDb } = require('../config/database');

const recentComments = new Map();
const notificationSubscribers = new Map();

function safeJSONParse(str, fallback = []) {
  try {
    return JSON.parse(str || '[]');
  } catch (e) {
    return fallback;
  }
}

router.post('/comments', (req, res) => {
  const { activityId, userId, content } = req.body;
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  if (!activityId || !userId || !content) {
    return res.status(400).json({ error: '参数不完整' });
  }

  interactionDb.run(
    'INSERT INTO comments (id, activity_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, activityId, userId, content, createdAt],
    (err) => {
      if (err) {
        console.error('评论失败:', err);
        return res.status(500).json({ error: '评论失败，请重试' });
      }
      
      interactionDb.get('SELECT * FROM comments WHERE id = ?', [id], (err, comment) => {
        userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [userId], (err, user) => {
          comment.user = user || { id: userId, username: '未知用户' };
          
          if (!recentComments.has(activityId)) {
            recentComments.set(activityId, []);
          }
          const activityComments = recentComments.get(activityId);
          activityComments.unshift(comment);
          if (activityComments.length > 50) {
            activityComments.pop();
          }
          
          res.status(201).json(comment);
        });
      });
    }
  );
});

router.get('/comments/:activityId', (req, res) => {
  const { activityId } = req.params;
  const { since } = req.query;
  
  let query = 'SELECT * FROM comments WHERE activity_id = ?';
  let params = [activityId];
  
  if (since) {
    query += ' AND created_at > ?';
    params.push(since);
  }
  
  query += ' ORDER BY created_at DESC LIMIT 100';
  
  interactionDb.all(query, params, async (err, comments) => {
    if (err) {
      console.error('查询评论失败:', err);
      return res.status(500).json({ error: '查询失败，请重试' });
    }

    const userCache = new Map();
    const commentsWithUser = await Promise.all(comments.map(async (comment) => {
      return new Promise((resolve) => {
        if (userCache.has(comment.user_id)) {
          comment.user = userCache.get(comment.user_id);
          resolve(comment);
        } else {
          userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [comment.user_id], (err, user) => {
            const userData = user || { id: comment.user_id, username: '未知用户' };
            userCache.set(comment.user_id, userData);
            comment.user = userData;
            resolve(comment);
          });
        }
      });
    }));

    res.json(commentsWithUser);
  });
});

router.post('/favorites', (req, res) => {
  const { activityId, userId } = req.body;
  const id = uuidv4();

  interactionDb.run(
    'INSERT INTO favorites (id, activity_id, user_id) VALUES (?, ?, ?)',
    [id, activityId, userId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '已经收藏过了' });
        }
        console.error('收藏失败:', err);
        return res.status(500).json({ error: '收藏失败，请重试' });
      }
      res.status(201).json({ id, message: '收藏成功' });
    }
  );
});

router.delete('/favorites', (req, res) => {
  const { activityId, userId } = req.body;

  interactionDb.run(
    'DELETE FROM favorites WHERE activity_id = ? AND user_id = ?',
    [activityId, userId],
    function(err) {
      if (err) {
        console.error('取消收藏失败:', err);
        return res.status(500).json({ error: '取消收藏失败，请重试' });
      }
      if (this.changes === 0) return res.status(404).json({ error: '收藏不存在' });
      res.json({ message: '取消收藏成功' });
    }
  );
});

router.get('/favorites/:userId', (req, res) => {
  const { userId } = req.params;
  
  interactionDb.all(`
    SELECT f.activity_id, a.title, a.images, a.videos, a.category, a.created_at, a.user_id as activity_user_id
    FROM favorites f
    LEFT JOIN activities a ON f.activity_id = a.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `, [userId], async (err, favorites) => {
    if (err) {
      console.error('查询收藏失败:', err);
      return res.status(500).json({ error: '查询失败，请重试' });
    }

    const userCache = new Map();
    
    const favoritesWithDetails = await Promise.all(
      favorites.filter(f => f.activity_id).map(async (fav) => {
        return new Promise((resolve) => {
          fav.images = safeJSONParse(fav.images);
          fav.videos = safeJSONParse(fav.videos);
          
          if (userCache.has(fav.activity_user_id)) {
            fav.user = userCache.get(fav.activity_user_id);
            resolve(fav);
          } else {
            userDb.get('SELECT id, username, avatar FROM users WHERE id = ?', [fav.activity_user_id], (err, user) => {
              const userData = user || { id: fav.activity_user_id, username: '未知用户' };
              userCache.set(fav.activity_user_id, userData);
              fav.user = userData;
              resolve(fav);
            });
          }
        });
      })
    );

    res.json(favoritesWithDetails);
  });
});

router.get('/notifications/poll/:activityId', (req, res) => {
  const { activityId } = req.params;
  const { since } = req.query;
  
  interactionDb.all(`
    SELECT c.*, u.username, u.avatar
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.activity_id = ? AND c.created_at > ?
    ORDER BY c.created_at DESC
    LIMIT 20
  `, [activityId, since || '1970-01-01'], (err, comments) => {
    if (err) {
      console.error('轮询通知失败:', err);
      return res.status(500).json({ error: '查询失败' });
    }
    res.json({
      comments: comments.map(c => ({
        ...c,
        user: { id: c.user_id, username: c.username || '未知用户', avatar: c.avatar }
      })),
      timestamp: new Date().toISOString()
    });
  });
});

module.exports = router;
