import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Home = () => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProcesses();
  }, [filter]);

  const fetchProcesses = async () => {
    try {
      const params = filter ? { type: filter } : {};
      const response = await api.get('/process', { params });
      setProcesses(response.data.data || []);
    } catch (error) {
      console.error('获取工艺列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const types = ['啤酒', '葡萄酒', '威士忌', '清酒', '其他'];

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="home-header">
        <h1 className="home-title">发现酿造工艺</h1>
      </div>
      
      <div className="home-filters">
        <button
          className={`filter-btn ${!filter ? 'active' : ''}`}
          onClick={() => setFilter('')}
        >
          全部
        </button>
        {types.map(type => (
          <button
            key={type}
            className={`filter-btn ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="process-grid">
        {processes.map(process => (
          <div
            key={process._id}
            className="process-card"
            onClick={() => navigate(`/process/${process._id}`)}
          >
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
                  <span>💬 {process.commentCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {processes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🍺</div>
          <div className="empty-state-text">暂无工艺记录</div>
        </div>
      )}
    </div>
  );
};

export default Home;
