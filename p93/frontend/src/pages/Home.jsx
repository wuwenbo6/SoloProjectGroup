import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { craftAPI } from '../services/api';
import './Home.css';

const Home = () => {
  const [crafts, setCrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrafts();
  }, []);

  const loadCrafts = async () => {
    try {
      const data = await craftAPI.getAll({ isPublic: true });
      setCrafts(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container">加载中...</div>;
  }

  return (
    <div className="container">
      <div className="home-header">
        <h1>发现陶瓷工艺</h1>
        <p>探索精美的陶瓷烧制工艺，获取灵感</p>
      </div>

      {crafts.length === 0 ? (
        <div className="empty-state card">
          <p>暂无工艺记录</p>
          <Link to="/craft/new" className="btn btn-primary">创建第一个工艺</Link>
        </div>
      ) : (
        <div className="craft-grid">
          {crafts.map((craft) => (
            <Link to={`/craft/${craft.id}`} key={craft.id} className="craft-card card">
              {craft.images && craft.images.length > 0 && (
                <div className="craft-image">
                  <img src={craft.images[0]} alt={craft.title} />
                </div>
              )}
              <div className="craft-content">
                <h3>{craft.title}</h3>
                <p className="craft-desc">{craft.description}</p>
                <div className="craft-meta">
                  {craft.author && (
                    <span className="author">
                      {craft.author.avatar && <img src={craft.author.avatar} alt="" />}
                      {craft.author.username}
                    </span>
                  )}
                  <span className="likes">❤️ {craft.likes || 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
