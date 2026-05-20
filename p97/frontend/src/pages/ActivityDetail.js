import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { activityAPI, interactionAPI, exportAPI } from '../services/api';

function ActivityDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNewComments, setHasNewComments] = useState(false);
  const [steps, setSteps] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showStepForm, setShowStepForm] = useState(false);
  const [stepForm, setStepForm] = useState({ stepNumber: '', title: '', description: '' });
  const [stepImage, setStepImage] = useState(null);
  const [qaInputs, setQaInputs] = useState({});
  const [answerInputs, setAnswerInputs] = useState({});
  const lastPollTime = useRef(new Date().toISOString());
  const pollInterval = useRef(null);

  useEffect(() => {
    loadActivity();
    loadSteps();
    loadRecommendations();
    if (user) {
      checkFavorite();
    }
    startCommentPolling();
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [id, user]);

  const startCommentPolling = () => {
    pollInterval.current = setInterval(async () => {
      try {
        const res = await interactionAPI.pollComments(id, lastPollTime.current);
        if (res.data.comments && res.data.comments.length > 0) {
          const newComments = res.data.comments.filter(
            nc => !comments.some(c => c.id === nc.id)
          );
          if (newComments.length > 0) {
            setComments(prev => [...newComments, ...prev]);
            setHasNewComments(true);
          }
          lastPollTime.current = res.data.timestamp;
        }
      } catch (err) {
        console.error('轮询评论失败:', err);
      }
    }, 3000);
  };

  const loadActivity = async () => {
    try {
      const res = await activityAPI.getById(id);
      setActivity(res.data);
      setComments(res.data.comments || []);
      lastPollTime.current = new Date().toISOString();
    } catch (err) {
      console.error('加载活动详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSteps = async () => {
    try {
      const res = await activityAPI.getSteps(id);
      setSteps(res.data);
    } catch (err) {
      console.error('加载步骤失败:', err);
    }
  };

  const loadRecommendations = async () => {
    try {
      const res = await exportAPI.getRecommendations(id, 5);
      setRecommendations(res.data);
    } catch (err) {
      console.error('加载推荐失败:', err);
    }
  };

  const checkFavorite = async () => {
    try {
      const res = await interactionAPI.getFavorites(user.id);
      const favIds = res.data.map(f => f.activity_id || f);
      setIsFavorite(favIds.includes(id));
    } catch (err) {
      console.error('检查收藏状态失败:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!newComment.trim()) return;

    try {
      const res = await interactionAPI.addComment({
        activityId: id,
        userId: user.id,
        content: newComment
      });
      setComments([res.data, ...comments]);
      setNewComment('');
      setHasNewComments(false);
    } catch (err) {
      console.error('评论失败:', err);
      alert(err.response?.data?.error || '评论失败，请重试');
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }

    try {
      if (isFavorite) {
        await interactionAPI.removeFavorite({
          activityId: id,
          userId: user.id
        });
        setIsFavorite(false);
      } else {
        await interactionAPI.addFavorite({
          activityId: id,
          userId: user.id
        });
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('收藏操作失败:', err);
      alert(err.response?.data?.error || '操作失败，请重试');
    }
  };

  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!stepForm.title.trim()) {
      alert('请输入步骤标题');
      return;
    }

    try {
      const formDataObj = new FormData();
      formDataObj.append('stepNumber', stepForm.stepNumber || steps.length + 1);
      formDataObj.append('title', stepForm.title);
      formDataObj.append('description', stepForm.description);
      if (stepImage) {
        formDataObj.append('image', stepImage);
      }

      await activityAPI.addStep(id, formDataObj);
      setShowStepForm(false);
      setStepForm({ stepNumber: '', title: '', description: '' });
      setStepImage(null);
      loadSteps();
    } catch (err) {
      console.error('添加步骤失败:', err);
      alert('添加失败，请重试');
    }
  };

  const handleAddQA = async (stepId) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    const question = qaInputs[stepId];
    if (!question?.trim()) return;

    try {
      await interactionAPI.addStepQA(stepId, {
        activityId: id,
        userId: user.id,
        question
      });
      setQaInputs(prev => ({ ...prev, [stepId]: '' }));
      loadSteps();
    } catch (err) {
      console.error('提问失败:', err);
      alert('提问失败，请重试');
    }
  };

  const handleAnswerQA = async (qaId, stepId) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    const answer = answerInputs[qaId];
    if (!answer?.trim()) return;

    try {
      await interactionAPI.answerQA(qaId, {
        answer,
        userId: user.id
      });
      setAnswerInputs(prev => ({ ...prev, [qaId]: '' }));
      loadSteps();
    } catch (err) {
      console.error('回答失败:', err);
      alert('回答失败，请重试');
    }
  };

  const handleDeleteQA = async (qaId) => {
    if (window.confirm('确定删除这个问题吗？')) {
      try {
        await interactionAPI.deleteQA(qaId);
        loadSteps();
      } catch (err) {
        console.error('删除失败:', err);
      }
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!activity) {
    return <div className="card">活动不存在</div>;
  }

  const isOwner = user && user.id === activity.user?.id;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
      <div className="card">
        <span className="category-tag">{activity.category || '其他'}</span>
        <h1 style={{ marginBottom: '15px', fontSize: '32px' }}>{activity.title}</h1>
        
        <div className="user-info" style={{ marginBottom: '20px' }}>
          <Link to={`/profile/${activity.user?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
            <div className="avatar">
              {activity.user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>{activity.user?.username || '未知用户'}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                {new Date(activity.created_at).toLocaleDateString()}
              </div>
            </div>
          </Link>
        </div>

        <div className="activity-meta" style={{ marginBottom: '20px' }}>
          <span>📍 {activity.location || '未知地点'}</span>
          <span>📅 {activity.date || '待定日期'}</span>
          <span>👁️ {activity.view_count || 0} 次浏览</span>
        </div>

        {activity.videos && activity.videos.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {activity.videos.map((video, index) => (
              <video 
                key={index}
                src={`http://localhost:3001${video}`}
                controls
                style={{ 
                  width: '100%', 
                  maxHeight: '500px', 
                  borderRadius: '12px',
                  marginBottom: '15px',
                  background: '#000'
                }}
              />
            ))}
          </div>
        )}

        {activity.images && activity.images.length > 0 && (
          <div className="detail-images">
            {activity.images.map((img, index) => (
              <img 
                key={index}
                src={`http://localhost:3001${img}`}
                alt={`${activity.title}-${index}`}
              />
            ))}
          </div>
        )}

        <div style={{ marginBottom: '30px', lineHeight: '1.8', color: '#333' }}>
          {activity.description || '暂无描述'}
        </div>

        <div className="actions" style={{ marginBottom: '30px' }}>
          <button 
            className={`btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleToggleFavorite}
          >
            {isFavorite ? '❤️ 已收藏' : '🤍 收藏'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => window.navigator.clipboard.writeText(window.location.href)}
          >
            🔗 分享链接
          </button>
        </div>

        {steps.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '15px' }}>📋 活动步骤</h3>
            {steps.map(step => (
              <div key={step.id} className="step-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <span className="step-number">{step.step_number}</span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>{step.title}</h4>
                    {step.description && (
                      <p style={{ color: '#666', lineHeight: '1.6' }}>{step.description}</p>
                    )}
                    {step.image && (
                      <img 
                        src={`http://localhost:3001${step.image}`}
                        alt={step.title}
                        style={{ width: '100%', maxWidth: '400px', borderRadius: '8px', marginTop: '10px' }}
                      />
                    )}
                  </div>
                </div>

                {step.qa && step.qa.length > 0 && (
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                    <h5 style={{ marginBottom: '10px', color: '#666' }}>💬 互动问答 ({step.qa.length})</h5>
                    {step.qa.map(qa => (
                      <div key={qa.id} className="qa-item">
                        <div className="qa-question">
                          <span style={{ color: '#667eea', fontWeight: '600', marginRight: '8px' }}>Q:</span>
                          {qa.question}
                          <span style={{ fontSize: '12px', color: '#999', marginLeft: '10px' }}>
                            — {qa.user?.username || '未知用户'}
                          </span>
                          {user && (user.id === qa.user_id || isOwner) && (
                            <button 
                              onClick={() => handleDeleteQA(qa.id)}
                              style={{ 
                                float: 'right', 
                                background: 'none', 
                                border: 'none', 
                                color: '#ff4757', 
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              删除
                            </button>
                          )}
                        </div>
                        {qa.answer ? (
                          <div className="qa-answer">
                            <span style={{ fontWeight: '600' }}>A:</span> {qa.answer}
                            <span style={{ fontSize: '12px', marginLeft: '10px' }}>
                              — {qa.answerUser?.username || '未知用户'}
                            </span>
                          </div>
                        ) : isOwner ? (
                          <div className="qa-input">
                            <input
                              type="text"
                              placeholder="回答这个问题..."
                              value={answerInputs[qa.id] || ''}
                              onChange={(e) => setAnswerInputs(prev => ({ ...prev, [qa.id]: e.target.value }))}
                            />
                            <button 
                              className="btn btn-primary"
                              onClick={() => handleAnswerQA(qa.id, step.id)}
                            >
                              回答
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {user && (
                  <div className="qa-input">
                    <input
                      type="text"
                      placeholder="对这个步骤有问题？来提问吧..."
                      value={qaInputs[step.id] || ''}
                      onChange={(e) => setQaInputs(prev => ({ ...prev, [step.id]: e.target.value }))}
                    />
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleAddQA(step.id)}
                    >
                      提问
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <div style={{ marginBottom: '30px' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowStepForm(!showStepForm)}
              style={{ marginBottom: '15px' }}
            >
              {showStepForm ? '取消' : '+ 添加步骤'}
            </button>

            {showStepForm && (
              <form onSubmit={handleAddStep} style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                  <div>
                    <label>步骤序号</label>
                    <input
                      type="number"
                      value={stepForm.stepNumber || steps.length + 1}
                      onChange={(e) => setStepForm({ ...stepForm, stepNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>步骤标题 *</label>
                    <input
                      type="text"
                      value={stepForm.title}
                      onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>步骤描述</label>
                  <textarea
                    value={stepForm.description}
                    onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>步骤图片</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setStepImage(e.target.files[0])}
                    style={{ padding: '10px' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary">添加步骤</button>
              </form>
            )}
          </div>
        )}

        <div className="comment-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>💬 评论 ({comments.length})</h3>
            {hasNewComments && (
              <button 
                className="btn btn-secondary"
                onClick={() => { setHasNewComments(false); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                🔔 有新评论，点击查看
              </button>
            )}
          </div>
          
          {user && (
            <form onSubmit={handleAddComment} style={{ marginBottom: '30px' }}>
              <div className="form-group">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="写下你的评论..."
                  rows="3"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                发表评论
              </button>
            </form>
          )}

          {comments.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <p>暂无评论，来抢沙发吧！</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <Link to={`/profile/${comment.user?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                      {comment.user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="comment-user">{comment.user?.username || '未知用户'}</span>
                  </Link>
                  <span className="comment-time">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="comment-content">{comment.content}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        {recommendations.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '15px' }}>✨ 相似活动推荐</h3>
            {recommendations.map(rec => (
              <div 
                key={rec.id}
                className="recommendation-card"
                onClick={() => navigate(`/activity/${rec.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{rec.title}</h4>
                  <span className="similarity-badge">{rec.similarity}% 相似</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <span>📍 {rec.location || '未知'}</span>
                  <span style={{ marginLeft: '10px' }}>🏷️ {rec.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>📤 导出活动</h3>
          <div className="export-btn-group" style={{ flexDirection: 'column' }}>
            <button 
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const res = await exportAPI.exportActivities('json');
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `activity_${id}.json`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                } catch (err) {
                  console.error('导出失败:', err);
                }
              }}
            >
              📄 导出为 JSON
            </button>
            <button 
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const res = await exportAPI.exportActivities('csv');
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `activity_${id}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                } catch (err) {
                  console.error('导出失败:', err);
                }
              }}
            >
              📊 导出为 CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityDetail;
