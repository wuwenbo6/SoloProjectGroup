import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [userProcesses, setUserProcesses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('processes');
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [favoritePage, setFavoritePage] = useState(1);
  const [hasMoreFavorites, setHasMoreFavorites] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [exportFormat, setExportFormat] = useState('json');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const targetId = id || (currentUser ? currentUser.id : null);
    if (targetId) {
      setIsOwnProfile(currentUser && currentUser.id === targetId);
      fetchProfile(targetId);
      fetchUserProcesses(targetId);
      if (isOwnProfile) {
        fetchFavorites();
      }
    }
  }, [id, currentUser, isOwnProfile]);

  const fetchProfile = async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`);
      setProfileUser(response.data);
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProcesses = async (userId) => {
    try {
      const response = await api.get('/process', { params: { userId } });
      setUserProcesses(response.data.data || []);
    } catch (error) {
      console.error('获取用户工艺失败:', error);
    }
  };

  const fetchFavorites = async (page = 1) => {
    try {
      const response = await api.get('/interaction/favorites/my', {
        params: { page, limit: 20 }
      });
      if (page === 1) {
        setFavorites(response.data.data);
      } else {
        setFavorites(prev => [...prev, ...response.data.data]);
      }
      setHasMoreFavorites(page < response.data.pages);
      setFavoritePage(page);
    } catch (error) {
      console.error('获取收藏失败:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === userProcesses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(userProcesses.map(p => p._id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.post('/process/export', {
        ids: selectedIds.length > 0 ? selectedIds : null,
        format: exportFormat
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = exportFormat === 'markdown' ? 'md' : 'json';
      link.setAttribute('download', `brewing-processes.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setShowExportMenu(false);
      setSelectedIds([]);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!profileUser) {
    return <div className="loading">用户不存在</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar">
          {profileUser.username[0].toUpperCase()}
        </div>
        <h2 className="profile-name">{profileUser.username}</h2>
        <p className="profile-bio">{profileUser.bio || '这个人很懒，什么都没写~'}</p>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{userProcesses.length}</div>
            <div className="profile-stat-label">工艺记录</div>
          </div>
          {isOwnProfile && (
            <div className="profile-stat">
              <div className="profile-stat-value">{favorites.length}</div>
              <div className="profile-stat-label">收藏</div>
            </div>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        <button
          className={`tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}
        >
          工艺记录
        </button>
        {isOwnProfile && (
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            我的收藏
          </button>
        )}
      </div>

      {isOwnProfile && activeTab === 'processes' && userProcesses.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          background: 'white',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedIds.length === userProcesses.length && userProcesses.length > 0}
                onChange={handleSelectAll}
                style={{ width: '18px', height: '18px' }}
              />
              <span>全选 ({selectedIds.length}/{userProcesses.length})</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="json">JSON格式</option>
              <option value="markdown">Markdown格式</option>
            </select>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                padding: '8px 20px',
                background: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              📤 导出
            </button>
          </div>
        </div>
      )}

      {showExportMenu && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #eee'
        }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
            {selectedIds.length > 0 
              ? `将导出选中的 ${selectedIds.length} 条工艺记录` 
              : '将导出全部工艺记录'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleExport}
              style={{
                padding: '10px 24px',
                background: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              确认导出
            </button>
            <button
              onClick={() => setShowExportMenu(false)}
              style={{
                padding: '10px 24px',
                background: 'white',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="process-grid">
        {activeTab === 'processes' && userProcesses.map(process => (
          <div
            key={process._id}
            className="process-card"
            style={{
              border: selectedIds.includes(process._id) ? '2px solid #8B4513' : 'none',
              position: 'relative'
            }}
          >
            {isOwnProfile && (
              <input
                type="checkbox"
                checked={selectedIds.includes(process._id)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleSelectOne(process._id);
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 10,
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
            )}
            <div onClick={() => navigate(`/process/${process._id}`)} style={{ cursor: 'pointer' }}>
            {process.images && process.images.length > 0 ? (
              <img
                src={process.images[0]}
                alt={process.title}
                className="process-card-image"
              />
            ) : (
              <div className="process-card-image" style={{
                background: 'linear-gradient(135deg, #f5e6d3 0%, #e6d5c3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px'
              }}>
                🍺
              </div>
            )}
            <div className="process-card-content">
              <div className="process-card-type">{process.type}</div>
              <h3 className="process-card-title">{process.title}</h3>
              <p className="process-card-description">{process.description}</p>
              <div className="process-card-footer">
                <span className="process-card-author">
                  {process.userId?.username || '匿名'}
                </span>
                <div className="process-card-stats">
                  <span>👁 {process.viewCount}</span>
                  <span>❤️ {process.likeCount}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        ))}

        {activeTab === 'favorites' && favorites.map(fav => (
          <div
            key={fav._id}
            className="process-card"
            onClick={() => navigate(`/process/${fav.processId._id}`)}
          >
            {fav.processId.images && fav.processId.images.length > 0 ? (
              <img
                src={fav.processId.images[0]}
                alt={fav.processId.title}
                className="process-card-image"
              />
            ) : (
              <div className="process-card-image" style={{
                background: 'linear-gradient(135deg, #f5e6d3 0%, #e6d5c3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px'
              }}>
                🍺
              </div>
            )}
            <div className="process-card-content">
              <div className="process-card-type">{fav.processId.type}</div>
              <h3 className="process-card-title">{fav.processId.title}</h3>
              <p className="process-card-description">{fav.processId.description}</p>
              <div className="process-card-footer">
                <span className="process-card-author">
                  {fav.processId.userId?.username || '匿名'}
                </span>
                <div className="process-card-stats">
                  <span>👁 {fav.processId.viewCount}</span>
                  <span>❤️ {fav.processId.likeCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(activeTab === 'processes' && userProcesses.length === 0) && (
        <div className="empty-state">
          <div className="empty-state-icon">🍺</div>
          <div className="empty-state-text">暂无工艺记录</div>
        </div>
      )}

      {(activeTab === 'favorites' && favorites.length === 0) && (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <div className="empty-state-text">暂无收藏</div>
        </div>
      )}
      
      {activeTab === 'favorites' && hasMoreFavorites && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            className="form-btn"
            style={{ padding: '10px 30px', width: 'auto' }}
            onClick={() => fetchFavorites(favoritePage + 1)}
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
