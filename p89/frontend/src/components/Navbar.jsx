import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          🍺 酿造工艺记录
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">首页</Link>
          {user ? (
            <>
              <Link to="/process/new" className="navbar-link">发布工艺</Link>
              <Link to="/profile" className="navbar-link">{user.username}</Link>
              <button onClick={logout} className="navbar-btn">退出</button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">登录</Link>
              <Link to="/register" className="navbar-btn">注册</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
