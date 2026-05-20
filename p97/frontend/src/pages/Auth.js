import React, { useState } from 'react';
import { userAPI } from '../services/api';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        const res = await userAPI.login({
          email: formData.email,
          password: formData.password
        });
        onLogin(res.data.user);
      } else {
        await userAPI.register(formData);
        const loginRes = await userAPI.login({
          email: formData.email,
          password: formData.password
        });
        onLogin(loginRes.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || '操作失败，请重试');
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isLogin ? '登录' : '注册'}
        </h2>
        
        <div className="tabs">
          <div 
            className={`tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            登录
          </div>
          <div 
            className={`tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            注册
          </div>
        </div>

        {error && (
          <div style={{ color: '#ff4757', textAlign: 'center', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label>邮箱</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {isLogin ? '登录' : '注册'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;
