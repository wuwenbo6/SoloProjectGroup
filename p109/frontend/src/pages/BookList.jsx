import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';

function BookList() {
  const [books, setBooks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    dynasty: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const { token, user } = useContext(AuthContext);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/books`
      );
      setBooks(response.data);
    } catch (err) {
      console.error('获取书籍列表失败:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleCreateBook = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/books`,
        { ...newBook, userId: user.id }
      );
      setShowModal(false);
      setNewBook({ title: '', author: '', dynasty: '', description: '' });
      fetchBooks();
    } catch (err) {
      console.error('创建书籍失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px',
    },
    title: {
      margin: 0,
      color: '#2c3e50',
    },
    createButton: {
      padding: '10px 20px',
      background: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px',
    },
    card: {
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      textDecoration: 'none',
      color: 'inherit',
      transition: 'transform 0.2s',
    },
    bookTitle: {
      margin: '0 0 10px 0',
      color: '#2c3e50',
      fontSize: '18px',
    },
    bookMeta: {
      color: '#7f8c8d',
      fontSize: '14px',
      marginBottom: '10px',
    },
    bookDesc: {
      color: '#34495e',
      fontSize: '14px',
      marginBottom: '15px',
    },
    status: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      background: 'white',
      padding: '30px',
      borderRadius: '8px',
      width: '500,
      maxWidth: '90%',
    },
    modalTitle: {
      margin: '0 0 20px 0',
      color: '#2c3e50',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
    },
    input: {
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px',
    },
    textarea: {
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical',
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px',
    },
    cancelButton: {
      flex: 1,
      padding: '10px',
      background: '#95a5a6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    submitButton: {
      flex: 1,
      padding: '10px',
      background: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    empty: {
      textAlign: 'center',
      padding: '60px',
      background: 'white',
      borderRadius: '8px',
      color: '#7f8c8d',
    },
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>书籍列表</h1>
        <button onClick={() => setShowModal(true)} style={styles.createButton}>
          + 创建书籍
        </button>
      </div>

      {books.length === 0 ? (
        <div style={styles.empty}>
          <p>暂无书籍，点击上方按钮创建第一本古籍</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {books.map((book) => (
          <Link to={`/books/${book.id}`} key={book.id} style={styles.card}>
            <h3 style={styles.bookTitle}>{book.title}</h3>
            <div style={styles.bookMeta}>
              {book.author && <span>作者：{book.author}</span>}
              {book.dynasty && (
                <span style={{ marginLeft: '10px' }}>朝代：{book.dynasty}</span>
              )}
            </div>
            <p style={styles.bookDesc}>{book.description || '暂无描述'}</p>
            <div>
              <span style={{ ...styles.status, background: '#ecf0f1', color: '#7f8c8d' }}>
                {book.total_pages || 0} 页
              </span>
            </div>
          </Link>
        ))}
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>创建新书籍</h2>
            <form onSubmit={handleCreateBook} style={styles.form}>
              <input
                type="text"
                placeholder="书籍名称"
                value={newBook.title}
                onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                style={styles.input}
                required
              />
              <input
                type="text"
                placeholder="作者"
                value={newBook.author}
                onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="朝代"
                value={newBook.dynasty}
                onChange={(e) => setNewBook({ ...newBook, dynasty: e.target.value })}
                style={styles.input}
              />
              <textarea
                placeholder="书籍描述"
                value={newBook.description}
                onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                style={styles.textarea}
              />
              <div style={styles.buttonGroup}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelButton}>
                  取消
                </button>
                <button type="submit" style={styles.submitButton} disabled={loading}>
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookList;
