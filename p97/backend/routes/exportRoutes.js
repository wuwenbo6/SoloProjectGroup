const express = require('express');
const router = express.Router();
const { activityDb, userDb, interactionDb } = require('../config/database');

function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/[\s,，。、；;：:]+/).filter(w => w.length > 1);
  const words2 = text2.toLowerCase().split(/[\s,，。、；;：:]+/).filter(w => w.length > 1);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

router.get('/export/:format', (req, res) => {
  const { format } = req.params;
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
      console.error('导出失败:', err);
      return res.status(500).json({ error: '导出失败' });
    }
    
    const exportData = await Promise.all(activities.map(async (activity) => {
      return new Promise((resolve) => {
        userDb.get('SELECT username FROM users WHERE id = ?', [activity.user_id], (err, user) => {
          activityDb.all('SELECT * FROM activity_steps WHERE activity_id = ? ORDER BY step_number', [activity.id], (err, steps) => {
            interactionDb.all('SELECT COUNT(*) as count FROM comments WHERE activity_id = ?', [activity.id], (err, commentRes) => {
              resolve({
                id: activity.id,
                title: activity.title,
                description: activity.description,
                location: activity.location,
                date: activity.date,
                category: activity.category,
                author: user?.username || '未知',
                viewCount: activity.view_count || 0,
                commentCount: commentRes[0]?.count || 0,
                images: activity.images ? JSON.parse(activity.images) : [],
                videos: activity.videos ? JSON.parse(activity.videos) : [],
                steps: steps.map(s => ({
                  stepNumber: s.step_number,
                  title: s.title,
                  description: s.description
                })),
                createdAt: activity.created_at
              });
            });
          });
        });
      });
    }));
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="folk_activities_${Date.now()}.json"`);
      res.json(exportData);
    } else if (format === 'csv') {
      const headers = ['ID', '标题', '描述', '地点', '日期', '分类', '作者', '浏览量', '评论数', '创建时间'];
      const csvRows = [headers.join(',')];
      
      exportData.forEach(item => {
        const row = [
          `"${item.id}"`,
          `"${item.title.replace(/"/g, '""')}"`,
          `"${(item.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          `"${item.location || ''}"`,
          `"${item.date || ''}"`,
          `"${item.category || ''}"`,
          `"${item.author}"`,
          item.viewCount,
          item.commentCount,
          `"${item.createdAt}"`
        ];
        csvRows.push(row.join(','));
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="folk_activities_${Date.now()}.csv"`);
      res.send('\uFEFF' + csvRows.join('\n'));
    } else {
      res.status(400).json({ error: '不支持的格式' });
    }
  });
});

router.get('/recommendations/:activityId', (req, res) => {
  const { activityId } = req.params;
  const { limit = 5 } = req.query;
  
  activityDb.get('SELECT * FROM activities WHERE id = ?', [activityId], (err, targetActivity) => {
    if (err || !targetActivity) {
      return res.status(404).json({ error: '活动不存在' });
    }
    
    activityDb.all('SELECT * FROM activities WHERE id != ? ORDER BY created_at DESC LIMIT 50', [activityId], async (err, activities) => {
      if (err) {
        console.error('获取推荐失败:', err);
        return res.status(500).json({ error: '获取推荐失败' });
      }
      
      const activitiesWithScore = activities.map(activity => {
        let score = 0;
        
        if (activity.category === targetActivity.category) {
          score += 0.3;
        }
        
        const titleSimilarity = calculateSimilarity(targetActivity.title, activity.title);
        score += titleSimilarity * 0.3;
        
        const descSimilarity = calculateSimilarity(targetActivity.description || '', activity.description || '');
        score += descSimilarity * 0.25;
        
        const locationSimilarity = calculateSimilarity(targetActivity.location || '', activity.location || '');
        score += locationSimilarity * 0.15;
        
        if (activity.user_id === targetActivity.user_id) {
          score += 0.1;
        }
        
        return { activity, score };
      });
      
      activitiesWithScore.sort((a, b) => b.score - a.score);
      const topRecommendations = activitiesWithScore.slice(0, parseInt(limit));
      
      const recommendationsWithUser = await Promise.all(topRecommendations.map(async ({ activity, score }) => {
        return new Promise((resolve) => {
          userDb.get('SELECT id, username FROM users WHERE id = ?', [activity.user_id], (err, user) => {
            resolve({
              id: activity.id,
              title: activity.title,
              category: activity.category,
              location: activity.location,
              images: JSON.parse(activity.images || '[]'),
              user: user || { username: '未知用户' },
              similarity: Math.round(score * 100)
            });
          });
        });
      }));
      
      res.json(recommendationsWithUser);
    });
  });
});

router.get('/home/recommendations', (req, res) => {
  const { userId, limit = 10 } = req.query;
  
  activityDb.all('SELECT * FROM activities ORDER BY view_count DESC, created_at DESC LIMIT ?', [parseInt(limit)], async (err, activities) => {
    if (err) {
      console.error('获取推荐失败:', err);
      return res.status(500).json({ error: '获取推荐失败' });
    }
    
    const activitiesWithUser = await Promise.all(activities.map(async (activity) => {
      return new Promise((resolve) => {
        userDb.get('SELECT id, username FROM users WHERE id = ?', [activity.user_id], (err, user) => {
          activity.images = JSON.parse(activity.images || '[]');
          activity.videos = JSON.parse(activity.videos || '[]');
          activity.user = user || { username: '未知用户' };
          resolve(activity);
        });
      });
    }));
    
    res.json(activitiesWithUser);
  });
});

module.exports = router;
