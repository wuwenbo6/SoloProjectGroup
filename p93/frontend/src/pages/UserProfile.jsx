import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../store/userStore';
import { userAPI, craftAPI, favoriteAPI, exportAPI } from '../services/api';
import './UserProfile.css';

const UserProfile = () => {
  const { id } = useParams();
  const { user: currentUser, updateProfile } = useUser();
  const [profileUser, setProfileUser] = useState(null);
  const [userCrafts, setUserCrafts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('crafts');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', avatar: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const userData = await userAPI.getById(id);
      setProfileUser(userData);
      setEditForm({ bio: userData.bio || '', avatar: userData.avatar || '' });

      const craftsData = await craftAPI.getAll({});
      setUserCrafts(craftsData.filter(c => c.userId === id));

      const favData = await favoriteAPI.getByUserId(id);
      setFavorites(favData);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || currentUser.id !== id) return;
    
    try {
      const updated = await updateProfile(editForm);
      setProfileUser(updated);
      setEditing(false);
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const isOwnProfile = currentUser && currentUser.id === id;

  if (loading) {
    return <div className="container">加载中...</div>;
  }

  if (!profileUser) {
    return <div className="container">用户不存在</div>;
  }

  return (
    <div className="container">
      <div className="profile-container">
        <div className="profile-header card">
          <div className="profile-avatar">
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt={profileUser.username} />
            ) : (
              <div className="avatar-placeholder">
                {profileUser.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{profileUser.username}</h1>
            {editing && isOwnProfile ? (
              <div className="edit-form">
                <textarea
                  className="input textarea"
                  placeholder="介绍一下自己..."
                  value={editForm.bio}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="头像URL"
                  value={editForm.avatar}
                  onChange={(e) => setEditForm(prev => ({ ...prev, avatar: e.target.value }))}
                />
                <div className="edit-actions">
                  <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                    取消
                  </button>
                  <button className="btn btn-primary" onClick={handleUpdateProfile}>
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="profile-bio">{profileUser.bio || '这个人很懒，什么都没写'}</p>
                {isOwnProfile && (
                  <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                    编辑资料
                  </button>
                )}
              </>
            )}
          </div>
          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{userCrafts.length}</span>
              <span className="stat-label">工艺</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{favorites.length}</span>
              <span className="stat-label">收藏</span>
            </div>
          </div>
        </div>

        {isOwnProfile && userCrafts.length > 0 && (
          <div className="export-section card">
            <span className="export-label">导出我的工艺:</span>
            <div className="export-buttons">
              <button 
                className="btn btn-secondary"
                onClick={() => exportAPI.exportJSON(id)}
              >
                📄 导出 JSON
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => exportAPI.exportCSV(id)}
              >
                📊 导出 CSV
              </button>
            </div>
          </div>
        )}

        <div className="tabs card">
          <button
            className={`tab-btn ${activeTab === 'crafts' ? 'active' : ''}`}
            onClick={() => setActiveTab('crafts')}
          >
            我的工艺 ({userCrafts.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            我的收藏 ({favorites.length})
          </button>
        </div>

        <div className="content-section">
          {activeTab === 'crafts' ? (
            userCrafts.length === 0 ? (
              <div className="empty-state card">
                <p>还没有发布工艺</p>
                {isOwnProfile && (
                  <Link to="/craft/new" className="btn btn-primary">
                    创建第一个工艺
                  </Link>
                )}
              </div>
            ) : (
              <div className="crafts-grid">
                {userCrafts.map((craft) => (
                  <Link to={`/craft/${craft.id}`} key={craft.id} className="craft-card card">
                    {craft.images && craft.images.length > 0 && (
                      <div className="craft-card-image">
                        <img src={craft.images[0]} alt={craft.title} />
                      </div>
                    )}
                    <div className="craft-card-content">
                      <h3>{craft.title}</h3>
                      <p className="craft-card-desc">{craft.description}</p>
                      <div className="craft-card-footer">
                        <span>❤️ {craft.likes || 0}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            favorites.length === 0 ? (
              <div className="empty-state card">
                <p>还没有收藏任何工艺</p>
                <Link to="/" className="btn btn-primary">
                  去发现
                </Link>
              </div>
            ) : (
              <div className="crafts-grid">
                {favorites.map((fav) => (
                  fav.craft && (
                    <Link to={`/craft/${fav.craftId}`} key={fav.id} className="craft-card card">
                      {fav.craft.images && fav.craft.images.length > 0 && (
                        <div className="craft-card-image">
                          <img src={fav.craft.images[0]} alt={fav.craft.title} />
                        </div>
                      )}
                      <div className="craft-card-content">
                        <h3>{fav.craft.title}</h3>
                        <p className="craft-card-desc">{fav.craft.description}</p>
                        <div className="craft-card-footer">
                          {fav.craft.author && <span>{fav.craft.author.username}</span>}
                          <span>❤️ {fav.craft.likes || 0}</span>
                        </div>
                      </div>
                    </Link>
                  )
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
