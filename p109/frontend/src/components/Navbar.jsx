import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const styles = {
    navbar: {
      background: '#2c3e50',
      padding: '0 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: '60px',
    },
    logo: {
      color: 'white',
      fontSize: '20px',
      fontWeight: 'bold',
      textDecoration: 'none',
    },
    navLinks: {
      display: 'flex',
      gap: '20px',
      alignItems: 'center',
    },
    link: {
      color: 'white',
      textDecoration: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      transition: 'background 0.3s',
    },
    userInfo: {
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
    },
    username: {
      color: '#3498db',
    },
    button: {
      background: '#e74c3c',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
    },
  };

  return (
    <nav style={styles.navbar}>
      <div style={styles.container}>
        <Link to="/books" style={styles.logo}>
          📚 古籍数字化平台
        </Link>
        {user && (
          <div style={styles.navLinks}>
            <Link to="/books" style={styles.link}>书籍列表</Link>
            <div style={styles.userInfo}>
              <span>欢迎, <span style={styles.username}>{user.username}</span></span>
              <button onClick={handleLogout} style={styles.button}>
                退出
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
