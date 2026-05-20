import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../store/userStore';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    await login(username.trim());
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card card">
        <h1>欢迎来到陶瓷工艺平台</h1>
        <p>记录你的陶瓷烧制工艺，分享给更多人</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            className="input"
            placeholder="请输入你的昵称"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            进入平台
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
