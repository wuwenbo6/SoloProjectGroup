import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ActivityDetail from './pages/ActivityDetail';
import Profile from './pages/Profile';
import Auth from './pages/Auth';

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    navigate('/');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <Link to="/" className="logo">🎎 民俗活动</Link>
          <div className="nav-links">
            <Link to="/">活动广场</Link>
            {user ? (
              <>
                <Link to="/dashboard">操作台</Link>
                <Link to={`/profile/${user.id}`>我的主页</Link>
                <button onClick={handleLogout}>退出</button>
              </>
            ) : (
              <Link to="/auth">登录/注册</Link>
            )}
          </div>
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/auth" element={<Auth onLogin={handleLogin} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/activity/:id" element={<ActivityDetail user={user} />} />
          <Route path="/profile/:id" element={<Profile currentUser={user} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
