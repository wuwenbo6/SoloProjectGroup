import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityAPI } from '../services/api';

function Home({ user }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const navigate = useNavigate();

  const categories = ['', '节日庆典', '传统技艺', '民俗表演', '美食文化', '其他'];

  useEffect(() => {
    loadActivities();
  }, [category]);

  const loadActivities = async () => {
    try {
      const params = category ? { category } : {};
      const res = await activityAPI.getAll(params);
      setActivities(res.data);
    } catch (err) {
      console.error('加载活动失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>🎎 民俗活动广场</h2>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat || '全部分类'}</option>
            ))}
          </select>
        </div>

        {activities.length === 0 ? (
          <div className="empty-state">
            <h3>暂无活动</h3>
            <p>成为第一个分享民俗活动的人吧！</p>
          </div>
        ) : (
          <div className="grid">
            {activities.map(activity => (
              <div 
                key={activity.id}
                className="activity-card"
                onClick={() => navigate(`/activity/${activity.id}`)}
              >
                <div style={{ position: 'relative' }}>
                  {activity.images && activity.images.length > 0 ? (
                    <img 
                      src={`http://localhost:3001${activity.images[0]}`}
                      alt={activity.title}
                      className="activity-image"
                    />
                  ) : activity.videos && activity.videos.length > 0 ? (
                    <video 
                      src={`http://localhost:3001${activity.videos[0]}`}
                      className="activity-image"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="activity-image" style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '60px'
                    }}>
                      🎎
                    </div>
                  )}
                  {activity.videos && activity.videos.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      🎥 {activity.videos.length}
                    </div>
                  )}
                </div>
                <div className="activity-content">
                  <span className="category-tag">{activity.category || '其他'}</span>
                  <h3 className="activity-title">{activity.title}</h3>
                  <div className="activity-meta">
                    <span>📍 {activity.location || '未知'}</span>
                    <span>📅 {activity.date || '待定'}</span>
                  </div>
                  <p className="activity-desc">
                    {activity.description?.slice(0, 100)}
                    {activity.description?.length > 100 ? '...' : ''}
                  </p>
                  <div className="user-info">
                    <div className="avatar">
                      {activity.user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      {activity.user?.username || '未知用户'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
