import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useUser } from '../store/userStore';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            🏺 陶瓷工艺
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">发现</Link>
            {user && (
              <>
                <Link to="/craft/new" className="nav-link">+ 创建工艺</Link>
                <Link to={`/user/${user.id}`} className="nav-link">我的</Link>
              </>
            )}
          </nav>
          <div className="auth-section">
            {user ? (
              <div className="user-menu">
                <span className="username">{user.username}</span>
                <button className="btn-secondary btn" onClick={handleLogout}>退出</button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary">登录</Link>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>陶瓷工艺记录平台 © 2024</p>
      </footer>
    </div>
  );
};

export default Layout;
