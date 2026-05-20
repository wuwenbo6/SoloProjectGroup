import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUser } from '../store/userStore';
import { craftAPI, commentAPI, favoriteAPI, qaAPI, exportAPI } from '../services/api';
import './CraftDetail.css';

const CraftDetail = () => {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [craft, setCraft] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qaList, setQaList] = useState([]);
  const [expandedSteps, setExpandedSteps] = useState({});
  const [newQuestion, setNewQuestion] = useState({});
  const [answering, setAnswering] = useState({});
  const [newAnswer, setNewAnswer] = useState({});
  const [similarCrafts, setSimilarCrafts] = useState([]);

  useEffect(() => {
    loadData();
    
    const pollInterval = setInterval(async () => {
      try {
        const latestComments = await commentAPI.getByCraftId(id);
        setComments(prev => {
          if (prev.length !== latestComments.length) {
            return latestComments;
          }
          const hasNew = latestComments.some(
            c => !prev.some(p => p.id === c.id)
          );
          return hasNew ? latestComments : prev;
        });
      } catch (e) {
        console.error('轮询评论失败:', e);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [id]);

  const loadData = async () => {
    try {
      const [craftData, commentsData, qaData, similarData] = await Promise.all([
        craftAPI.getById(id),
        commentAPI.getByCraftId(id),
        qaAPI.getByCraftId(id),
        exportAPI.getSimilarCrafts(id),
      ]);
      setCraft(craftData);
      setComments(commentsData);
      setQaList(qaData);
      setSimilarCrafts(similarData);
      
      if (user) {
        const favResult = await favoriteAPI.check(user.id, id);
        setIsFavorite(favResult.isFavorite);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    await craftAPI.like(id);
    setCraft(prev => ({ ...prev, likes: (prev.likes || 0) + 1 }));
  };

  const handleFavorite = async () => {
    if (!user) {
      alert('请先登录');
      navigate('/login');
      return;
    }
    await favoriteAPI.toggle({ userId: user.id, craftId: id });
    setIsFavorite(!isFavorite);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      navigate('/login');
      return;
    }
    if (!newComment.trim()) return;

    const comment = await commentAPI.create({
      craftId: id,
      userId: user.id,
      username: user.username,
      content: newComment.trim(),
    });
    setComments(prev => [...prev, comment]);
    setNewComment('');
  };

  const handleDelete = async () => {
    if (confirm('确定要删除这个工艺吗？')) {
      await craftAPI.delete(id);
      navigate('/');
    }
  };

  const toggleStep = (index) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSubmitQuestion = async (stepIndex) => {
    if (!user) {
      alert('请先登录');
      navigate('/login');
      return;
    }
    const question = newQuestion[stepIndex];
    if (!question?.trim()) return;

    const qa = await qaAPI.create({
      craftId: id,
      stepIndex,
      userId: user.id,
      username: user.username,
      question: question.trim(),
    });
    setQaList(prev => [...prev, qa]);
    setNewQuestion(prev => ({ ...prev, [stepIndex]: '' }));
  };

  const handleSubmitAnswer = async (qaId) => {
    if (!user) {
      alert('请先登录');
      navigate('/login');
      return;
    }
    const answer = newAnswer[qaId];
    if (!answer?.trim()) return;

    const updatedQA = await qaAPI.addAnswer(qaId, {
      userId: user.id,
      username: user.username,
      content: answer.trim(),
    });
    setQaList(prev => prev.map(qa => qa.id === qaId ? updatedQA : qa));
    setNewAnswer(prev => ({ ...prev, [qaId]: '' }));
    setAnswering(prev => ({ ...prev, [qaId]: false }));
  };

  if (loading) {
    return <div className="container">加载中...</div>;
  }

  if (!craft) {
    return <div className="container">工艺不存在</div>;
  }

  const isOwner = user && user.id === craft.userId;

  return (
    <div className="container">
      <div className="detail-container">
        <div className="detail-header card">
          <h1 className="craft-title">{craft.title}</h1>
          <div className="craft-meta-row">
            {craft.author && (
              <Link to={`/user/${craft.author.id}`} className="author-info">
                {craft.author.avatar && <img src={craft.author.avatar} alt="" />}
                <span>{craft.author.username}</span>
              </Link>
            )}
            <div className="action-buttons">
              <button className="btn btn-secondary" onClick={handleLike}>
                ❤️ {craft.likes || 0}
              </button>
              <button 
                className={`btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}`}
                onClick={handleFavorite}
              >
                {isFavorite ? '⭐ 已收藏' : '☆ 收藏'}
              </button>
              {isOwner && (
                <>
                  <Link to={`/craft/${id}/edit`} className="btn btn-secondary">
                    编辑
                  </Link>
                  <button className="btn btn-secondary" onClick={handleDelete}>
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {craft.images && craft.images.length > 0 && (
          <div className="images-section card">
            <div className="main-image">
              <img src={craft.images[0]} alt={craft.title} />
            </div>
            {craft.images.length > 1 && (
              <div className="thumbnails">
                {craft.images.slice(1).map((img, index) => (
                  <img key={index} src={img} alt="" />
                ))}
              </div>
            )}
          </div>
        )}

        {craft.videos && craft.videos.length > 0 && (
          <div className="videos-section card">
            <h2>视频演示</h2>
            <div className="videos-grid">
              {craft.videos.map((video, index) => (
                <div key={index} className="video-player">
                  <video src={video} controls />
                </div>
              ))}
            </div>
          </div>
        )}

        {craft.description && (
          <div className="section card">
            <h2>工艺简介</h2>
            <p className="description">{craft.description}</p>
          </div>
        )}

        <div className="params-section card">
          <h2>烧制参数</h2>
          <div className="params-grid">
            <div className="param-item">
              <span className="param-label">温度</span>
              <span className="param-value">{craft.temperature}°C</span>
            </div>
            <div className="param-item">
              <span className="param-label">时长</span>
              <span className="param-value">{craft.duration} 小时</span>
            </div>
          </div>
        </div>

        {craft.materials && craft.materials.length > 0 && (
          <div className="section card">
            <h2>材料清单</h2>
            <ul className="materials-list">
              {craft.materials.map((material, index) => (
                <li key={index}>• {material}</li>
              ))}
            </ul>
          </div>
        )}

        {craft.steps && craft.steps.length > 0 && (
          <div className="section card">
            <h2>制作步骤</h2>
            <div className="steps-list">
              {craft.steps.map((step, index) => {
                const stepQA = qaList.filter(qa => qa.stepIndex === index);
                const isExpanded = expandedSteps[index];
                
                return (
                  <div key={index} className="step-item-container">
                    <div className="step-item" onClick={() => toggleStep(index)}>
                      <span className="step-index">{index + 1}</span>
                      <p>{step}</p>
                      <span className="step-toggle">
                        {isExpanded ? '▲' : '▼'}
                        {stepQA.length > 0 && <span className="qa-badge">{stepQA.length}</span>}
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <div className="step-qa-section">
                        <div className="qa-input-row">
                          <input
                            type="text"
                            className="input"
                            placeholder="针对这一步提问..."
                            value={newQuestion[index] || ''}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, [index]: e.target.value }))}
                          />
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleSubmitQuestion(index)}
                          >
                            提问
                          </button>
                        </div>
                        
                        <div className="qa-list">
                          {stepQA.map(qa => (
                            <div key={qa.id} className="qa-item">
                              <div className="question">
                                <span className="qa-author">{qa.username}:</span>
                                <span className="qa-content">{qa.question}</span>
                              </div>
                              {qa.answers.map(answer => (
                                <div key={answer.id} className="answer">
                                  <span className="qa-author">↳ {answer.username}:</span>
                                  <span className="qa-content">{answer.content}</span>
                                </div>
                              ))}
                              {answering[qa.id] ? (
                                <div className="answer-input-row">
                                  <input
                                    type="text"
                                    className="input"
                                    placeholder="输入你的回答..."
                                    value={newAnswer[qa.id] || ''}
                                    onChange={(e) => setNewAnswer(prev => ({ ...prev, [qa.id]: e.target.value }))}
                                  />
                                  <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleSubmitAnswer(qa.id)}
                                  >
                                    回答
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="btn-link"
                                  onClick={() => setAnswering(prev => ({ ...prev, [qa.id]: true }))}
                                >
                                  + 回答
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {similarCrafts.length > 0 && (
          <div className="section card">
            <h2>相似工艺推荐</h2>
            <div className="similar-grid">
              {similarCrafts.map(craft => (
                <Link to={`/craft/${craft.id}`} key={craft.id} className="similar-card">
                  {craft.images && craft.images.length > 0 && (
                    <img src={craft.images[0]} alt={craft.title} />
                  )}
                  <div className="similar-info">
                    <h4>{craft.title}</h4>
                    <div className="similar-meta">
                      <span className="similarity">
                        相似度: {Math.round(craft.similarity * 100)}%
                      </span>
                      <span>❤️ {craft.likes || 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="comments-section card">
          <h2>评论 ({comments.length})</h2>
          
          <form onSubmit={handleAddComment} className="comment-form">
            <textarea
              className="input textarea"
              placeholder="写下你的评论..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              发表评论
            </button>
          </form>

          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="empty-comments">暂无评论，来发表第一条评论吧</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <span className="comment-author">{comment.username}</span>
                    <span className="comment-date">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CraftDetail;
