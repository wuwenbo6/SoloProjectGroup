import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StepQnA from '../components/StepQnA';

const ProcessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [process, setProcess] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [expandedStep, setExpandedStep] = useState(null);

  useEffect(() => {
    fetchProcess();
    fetchComments();
    if (user) {
      checkLikeAndFavorite();
    }
  }, [id, user]);

  useEffect(() => {
    if (process) {
      fetchRecommendations();
    }
  }, [process?._id]);

  const fetchRecommendations = async () => {
    try {
      const response = await api.get(`/process/recommend/${id}`);
      setRecommendations(response.data);
    } catch (error) {
      console.error('获取推荐失败:', error);
    }
  };

  const fetchProcess = async () => {
    try {
      const response = await api.get(`/process/${id}`);
      setProcess(response.data);
    } catch (error) {
      console.error('获取工艺详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (page = 1) => {
    try {
      const response = await api.get(`/interaction/comments/${id}`, {
        params: { page, limit: 20 }
      });
      if (page === 1) {
        setComments(response.data.data);
      } else {
        setComments(prev => [...prev, ...response.data.data]);
      }
      setHasMoreComments(page < response.data.pages);
      setCommentPage(page);
    } catch (error) {
      console.error('获取评论失败:', error);
    }
  };

  const checkLikeAndFavorite = async () => {
    try {
      const [likeRes, favRes] = await Promise.all([
        api.get(`/interaction/likes/check/${id}`),
        api.get(`/interaction/favorites/check/${id}`)
      ]);
      setIsLiked(likeRes.data.isLiked);
      setIsFavorited(favRes.data.isFavorited);
    } catch (error) {
      console.error('检查状态失败:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (isLiked) {
        await api.delete(`/interaction/like/${id}`);
        setIsLiked(false);
        setProcess(prev => ({ ...prev, likeCount: prev.likeCount - 1 }));
      } else {
        await api.post(`/interaction/like/${id}`);
        setIsLiked(true);
        setProcess(prev => ({ ...prev, likeCount: prev.likeCount + 1 }));
      }
    } catch (error) {
      console.error('点赞操作失败:', error);
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (isFavorited) {
        await api.delete(`/interaction/favorite/${id}`);
        setIsFavorited(false);
      } else {
        await api.post(`/interaction/favorite/${id}`);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!newComment.trim()) return;

    try {
      const response = await api.post(`/interaction/comment/${id}`, {
        content: newComment
      });
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
      setProcess(prev => ({ ...prev, commentCount: prev.commentCount + 1 }));
    } catch (error) {
      console.error('评论失败:', error);
      alert(error.response?.data?.message || '评论失败，请重试');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/interaction/comment/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
      setProcess(prev => ({ ...prev, commentCount: prev.commentCount - 1 }));
    } catch (error) {
      console.error('删除评论失败:', error);
    }
  };

  const handleDeleteProcess = async () => {
    if (!window.confirm('确定要删除这个工艺记录吗？')) return;
    try {
      await api.delete(`/process/${id}`);
      navigate('/');
    } catch (error) {
      console.error('删除工艺失败:', error);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!process) {
    return <div className="loading">工艺不存在</div>;
  }

  return (
    <div className="detail-container">
      <div className="detail-header">
        <div className="detail-type">{process.type}</div>
        <h1 className="detail-title">{process.title}</h1>
        <div className="detail-meta" style={{ marginTop: '16px' }}>
          <Link to={`/user/${process.userId._id}`} className="detail-author">
            {process.userId.avatar ? (
              <img src={process.userId.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#8B4513',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {process.userId.username[0]}
              </div>
            )}
            {process.userId.username}
          </Link>
          <span>{new Date(process.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="detail-stats">
          <div className="stat-item">👁 {process.viewCount} 浏览</div>
          <div className="stat-item">❤️ {process.likeCount} 点赞</div>
          <div className="stat-item">💬 {process.commentCount} 评论</div>
        </div>
        <div className="detail-actions">
          <button
            className={`action-btn ${isLiked ? 'liked' : 'secondary'}`}
            onClick={handleLike}
          >
            ❤️ {isLiked ? '已点赞' : '点赞'}
          </button>
          <button
            className={`action-btn ${isFavorited ? 'favorited' : 'secondary'}`}
            onClick={handleFavorite}
          >
            ⭐ {isFavorited ? '已收藏' : '收藏'}
          </button>
          {user && user.id === process.userId._id && (
            <>
              <button
                className="action-btn secondary"
                onClick={() => navigate(`/process/edit/${id}`)}
              >
                ✏️ 编辑
              </button>
              <button
                className="action-btn secondary"
                onClick={handleDeleteProcess}
                style={{ color: '#e74c3c' }}
              >
                🗑️ 删除
              </button>
            </>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h3 className="section-heading">工艺描述</h3>
        <p className="detail-description">{process.description}</p>
      </div>

      {process.images && process.images.length > 0 && (
        <div className="detail-section">
          <h3 className="section-heading">工艺图片</h3>
          <div className="detail-images">
            {process.images.map((image, index) => (
              <img key={index} src={image} alt="" className="detail-image" />
            ))}
          </div>
        </div>
      )}

      {process.videos && process.videos.length > 0 && (
        <div className="detail-section">
          <h3 className="section-heading">工艺视频</h3>
          <div className="detail-images">
            {process.videos.map((video, index) => (
              <video
                key={index}
                src={video}
                controls
                style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px' }}
              />
            ))}
          </div>
        </div>
      )}

      {process.ingredients && process.ingredients.length > 0 && (
        <div className="detail-section">
          <h3 className="section-heading">原料清单</h3>
          <div className="ingredient-list">
            {process.ingredients.map((ing, index) => (
              <div key={index} className="ingredient-tag">
                <span>{ing.name}</span>
                <span>{ing.quantity} {ing.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {process.steps && process.steps.length > 0 && (
        <div className="detail-section">
          <h3 className="section-heading">酿造步骤</h3>
          <div className="step-list">
            {process.steps.map((step, index) => (
              <div key={index} className="step-card">
                <div
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  style={{ display: 'flex', gap: '16px', cursor: 'pointer' }}
                >
                  <div className="step-card-number">{index + 1}</div>
                  <div className="step-card-content" style={{ flex: 1 }}>
                    <h4 className="step-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {step.title}
                      <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
                        {expandedStep === index ? '收起 ▲' : '展开 ▼'}
                      </span>
                    </h4>
                    <p className="step-card-description">{step.description}</p>
                    <div className="step-card-meta">
                      {step.duration && <span>⏱ {step.duration}</span>}
                      {step.temperature && <span>🌡 {step.temperature}</span>}
                    </div>
                  </div>
                </div>
                {expandedStep === index && (
                  <StepQnA processId={id} stepId={index + 1} stepTitle={step.title} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3 className="section-heading">评论 ({comments.length})</h3>
        <form onSubmit={handleComment} className="comment-input-section">
          <textarea
            className="comment-input"
            placeholder={user ? "写下你的评论..." : "请先登录后评论"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!user}
          />
          <button type="submit" className="comment-submit-btn" disabled={!user}>
            发布
          </button>
        </form>
        <div className="comment-list">
          {comments.map(comment => (
            <div key={comment._id} className="comment-item">
              <div className="comment-header">
                <Link to={`/user/${comment.userId._id}`} className="comment-author">
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#8B4513',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {comment.userId.username[0]}
                  </div>
                  <span className="comment-author-name">{comment.userId.username}</span>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="comment-date">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                  {user && user.id === comment.userId._id && (
                    <button
                      className="comment-delete"
                      onClick={() => handleDeleteComment(comment._id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              <p className="comment-content">{comment.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="empty-state" style={{ padding: '30px' }}>
              <div className="empty-state-text">暂无评论</div>
            </div>
          )}
          
          {hasMoreComments && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="form-btn"
                style={{ padding: '10px 30px', width: 'auto' }}
                onClick={() => fetchComments(commentPage + 1)}
              >
                加载更多评论
              </button>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="detail-section">
          <h3 className="section-heading">✨ 相似工艺推荐</h3>
          <div className="process-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {recommendations.slice(0, 4).map(p => (
              <div
                key={p._id}
                className="process-card"
                onClick={() => {
                  navigate(`/process/${p._id}`);
                  window.scrollTo(0, 0);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div style={{
                  position: 'relative',
                  height: '140px',
                  background: 'linear-gradient(135deg, #f5e6d3 0%, #e6d5c3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px'
                }}>
                  🍺
                  {p.similarity && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: '#8B4513',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      相似度 {p.similarity}%
                    </span>
                  )}
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: '#f5e6d3',
                    color: '#8B4513',
                    borderRadius: '12px',
                    fontSize: '12px',
                    marginBottom: '8px'
                  }}>
                    {p.type}
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{p.title}</h4>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#888' }}>
                    <span>👤 {p.userId?.username}</span>
                    <span>❤️ {p.likeCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessDetail;
