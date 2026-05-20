import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const StepQnA = ({ processId, stepId, stepTitle }) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '' });
  const [expandedQ, setExpandedQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, [processId, stepId]);

  const fetchQuestions = async () => {
    try {
      const response = await api.get(`/qna/${processId}/step/${stepId}`);
      setQuestions(response.data.data || []);
    } catch (error) {
      console.error('获取问题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!newQuestion.title || !newQuestion.content) {
      alert('请填写标题和内容');
      return;
    }

    try {
      const response = await api.post(`/qna/${processId}/step/${stepId}`, newQuestion);
      setQuestions(prev => [response.data, ...prev]);
      setNewQuestion({ title: '', content: '' });
      setShowForm(false);
    } catch (error) {
      alert('提交失败，请重试');
    }
  };

  const handleSubmitAnswer = async (questionId, content) => {
    if (!content.trim()) return;

    try {
      await api.post(`/qna/answer/${questionId}`, { content });
      fetchQuestions();
      setAnswers(prev => ({ ...prev, [questionId]: '' }));
    } catch (error) {
      alert('回答失败，请重试');
    }
  };

  const handleUpvote = async (questionId, answerId) => {
    try {
      await api.post(`/qna/answer/${answerId}/upvote`, { questionId });
      fetchQuestions();
    } catch (error) {
      console.error('点赞失败:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#999' }}>加载中...</div>;
  }

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>💬 步骤问答 ({questions.length})</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px',
            background: '#8B4513',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          提问
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmitQuestion} style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '8px' }}>
          <input
            type="text"
            placeholder="问题标题"
            value={newQuestion.title}
            onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          <textarea
            placeholder="详细描述你的问题..."
            value={newQuestion.content}
            onChange={(e) => setNewQuestion(prev => ({ ...prev, content: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minHeight: '80px'
            }}
          />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', background: '#8B4513', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              提交问题
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map(q => (
          <div key={q._id} style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
            <div
              onClick={() => setExpandedQ(expandedQ === q._id ? null : q._id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{q.title}</span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '14px', color: '#888' }}>
                  <span>👤 {q.userId?.username}</span>
                  <span>💬 {q.answerCount}</span>
                  {q.isResolved && <span style={{ color: 'green' }}>✓ 已解决</span>}
                </div>
              </div>
            </div>

            {expandedQ === q._id && (
              <>
                <p style={{ color: '#666', margin: '12px 0', fontSize: '14px' }}>{q.content}</p>
                
                <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                  <h5 style={{ margin: '0 0 12px 0' }}>回答 ({q.answers?.length || 0})</h5>
                  
                  {q.answers?.map(a => (
                    <div key={a._id} style={{
                      padding: '12px',
                      background: a.isAccepted ? '#e8f5e9' : '#f5f5f5',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500', fontSize: '14px' }}>
                          👤 {a.userId?.username}
                          {a.isAccepted && <span style={{ color: 'green', marginLeft: '8px' }}>✓ 最佳回答</span>}
                        </span>
                        <button
                          onClick={() => handleUpvote(q._id, a._id)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: '#666'
                          }}
                        >
                          👍 {a.upvotes}
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>{a.content}</p>
                    </div>
                  ))}

                  {user && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="写下你的回答..."
                        value={answers[q._id] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q._id]: e.target.value }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                      <button
                        onClick={() => handleSubmitAnswer(q._id, answers[q._id] || '')}
                        style={{
                          padding: '0 16px',
                          background: '#8B4513',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        回答
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
            暂无问题，快来提问吧！
          </div>
        )}
      </div>
    </div>
  );
};

export default StepQnA;
