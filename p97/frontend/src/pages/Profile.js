import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userAPI, activityAPI, interactionAPI } from '../services/api';

function Profile({ currentUser }) {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('activities');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    bio: '',
    avatar: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadUserData();
  }, [id]);

  const loadUserData = async () => {
    try {
      const userRes = await userAPI.getProfile(id);
      setUser(userRes.data);
      setEditForm({
        username: userRes.data.username || '',
        bio: userRes.data.bio || '',
        avatar: userRes.data.avatar || ''
      });

      const activityRes = await activityAPI.getAll({ userId: id });
      setActivities(activityRes.data);

      const favRes = await interactionAPI.getFavorites(id);
      const favoriteActivities = [];
      for (const activityId of favRes.data) {
        try {
          const activityRes = await activityAPI.getById(activityId);
          favoriteActivities.push(activityRes.data);
        } catch (e) {
          console.error('加载收藏活动失败:', e);
        }
      }
      setFavorites(favoriteActivities);
    } catch (err) {
      console.error('加载用户数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await userAPI.updateProfile(id, editForm);
      setUser(prev => ({ ...prev, ...editForm }));
      setIsEditing(false);
      if (currentUser && currentUser.id === id) {
        const updatedUser = { ...currentUser, ...editForm };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('更新资料失败:', err);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!user) {
    return <div className="card">用户不存在</div>;
  }

  const isOwnProfile = currentUser && currentUser.id === id;

  return (
    <div>
      <div className="card">
        <div className="profile-header">
          <div className="avatar profile-avatar">
            {user.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="profile-info">
            <h2>{user.username}</h2>
            <p style={{ color: '#666', marginBottom: '10px' }}>{user.email}</p>
            {user.bio && <p style={{ color: '#555', marginBottom: '15px' }}>{user.bio}</p>}
            <div className="profile-stats">
              <span>📝 {activities.length} 个活动</span>
              <span>❤️ {favorites.length} 个收藏</span>
            </div>
            {isOwnProfile && (
              <button 
                className="btn btn-secondary"
                onClick={() => setIsEditing(!isEditing)}
                style={{ marginTop: '15px' }}
              >
                {isEditing ? '取消' : '编辑资料'}
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <form onSubmit={handleUpdateProfile} style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>个人简介</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows="3"
                placeholder="介绍一下你自己..."
              />
            </div>
            <button type="submit" className="btn btn-primary">
              保存修改
            </button>
          </form>
        )}

        <div className="tabs" style={{ marginBottom: '20px' }}>
          <div 
            className={`tab ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            发布的活动 ({activities.length})
          </div>
          <div 
            className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            收藏的活动 ({favorites.length})
          </div>
        </div>

        {activeTab === 'activities' ? (
          activities.length === 0 ? (
            <div className="empty-state">
              <h3>还没有发布任何活动</h3>
              <p>去操作台发布第一个活动吧！</p>
            </div>
          ) : (
            <div className="grid">
              {activities.map(activity => (
                <div 
                  key={activity.id}
                  className="activity-card"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                >
                  {activity.images && activity.images.length > 0 ? (
                    <img 
                      src={`http://localhost:3001${activity.images[0]}`}
                      alt={activity.title}
                      className="activity-image"
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
                  <div className="activity-content">
                    <span className="category-tag">{activity.category || '其他'}</span>
                    <h3 className="activity-title">{activity.title}</h3>
                    <div className="activity-meta">
                      <span>📍 {activity.location || '未知'}</span>
                      <span>📅 {activity.date || '待定'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          favorites.length === 0 ? (
            <div className="empty-state">
              <h3>还没有收藏任何活动</h3>
              <p>去活动广场看看有什么有趣的活动吧！</p>
            </div>
          ) : (
            <div className="grid">
              {favorites.map(activity => (
                <div 
                  key={activity.activity_id || activity.id}
                  className="activity-card"
                  onClick={() => navigate(`/activity/${activity.activity_id || activity.id}`)}
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
                    <div className="user-info">
                      <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                        {activity.user?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span style={{ color: '#666', fontSize: '13px' }}>
                        {activity.user?.username || '未知用户'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Profile;
