import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';

function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const { user, token } = useContext(AuthContext);

  const fetchBook = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/books/${id}`
      );
      setBook(response.data);
    } catch (err) {
      console.error('获取书籍信息失败:', err);
    }
  };

  const fetchPages = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/books/${id}/pages`
      );
      setPages(response.data);
    } catch (err) {
      console.error('获取页面列表失败:', err);
    }
  };

  useEffect(() => {
    fetchBook();
    fetchPages();
  }, [id]);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });
    formData.append('startPage', startPage.toString());

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/books/${id}/pages/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      fetchPages();
      fetchBook();
    } catch (err) {
      console.error('上传失败:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleCorrect = async (pageId) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/pages/${pageId}/correct`
      );
      fetchPages();
    } catch (err) {
      console.error('矫正失败:', err);
    }
  };

  const handleSegment = async (pageId) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/pages/${pageId}/segment`
      );
      fetchPages();
    } catch (err) {
      console.error('分割失败:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      uploaded: '#f39c12',
      corrected: '#3498db',
      segmented: '#27ae60',
    };
    return colors[status] || '#95a5a6';
  };

  const getStatusText = (status) => {
    const texts = {
      uploaded: '已上传',
      corrected: '已矫正',
      segmented: '已分割',
    };
    return texts[status] || status;
  };

  if (!book) {
    return <div>加载中...</div>;
  }

  const styles = {
    header: {
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    title: {
      margin: '0 0 10px 0',
      color: '#2c3e50',
    },
    meta: {
      color: '#7f8c8d',
      marginBottom: '20px',
    },
    uploadSection: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    input: {
      padding: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      width: '80px',
    },
    fileInput: {
      padding: '8px',
    },
    button: {
      padding: '8px 16px',
      background: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    pagesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '15px',
      marginTop: '20px',
    },
    pageCard: {
      background: 'white',
      borderRadius: '8px',
      padding: '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      textAlign: 'center',
    },
    pageNumber: {
      fontWeight: 'bold',
      marginBottom: '10px',
      color: '#2c3e50',
    },
    statusBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      color: 'white',
      marginBottom: '10px',
    },
    actionButtons: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    },
    smallButton: {
      padding: '6px 10px',
      fontSize: '12px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    backButton: {
      marginBottom: '20px',
      padding: '8px 16px',
      background: '#95a5a6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-block',
    },
    empty: {
      textAlign: 'center',
      padding: '40px',
      background: 'white',
      borderRadius: '8px',
      color: '#7f8c8d',
      marginTop: '20px',
    },
  };

  return (
    <div>
      <button onClick={() => navigate('/books')} style={styles.backButton}>
        ← 返回列表
      </button>

      <div style={styles.header}>
        <h1 style={styles.title}>{book.title}</h1>
        <div style={styles.meta}>
          {book.author && <span>作者：{book.author}</span>}
          {book.dynasty && <span style={{ marginLeft: '20px' }}>朝代：{book.dynasty}</span>}
          <span style={{ marginLeft: '20px' }}>共 {pages.length} 页</span>
        </div>
        {book.description && <p>{book.description}</p>}

        <div style={styles.uploadSection}>
          <label>起始页码：</label>
          <input
            type="number"
            min="1"
            value={startPage}
            onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
            style={styles.input}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            style={styles.fileInput}
            disabled={uploading}
          />
          {uploading && <span>上传中...</span>}
        </div>
      </div>

      <h2 style={{ color: '#2c3e50' }}>页面列表</h2>

      {pages.length === 0 ? (
        <div style={styles.empty}>
          <p>暂无页面，请上传古籍扫描件</p>
        </div>
      ) : (
        <div style={styles.pagesGrid}>
          {pages.map((page) => (
            <div key={page.id} style={styles.pageCard}>
              <div style={styles.pageNumber}>第 {page.page_number} 页</div>
              <div style={{ ...styles.statusBadge, background: getStatusColor(page.status) }}>
                {getStatusText(page.status)}
              </div>
              <div style={styles.actionButtons}>
                {page.status === 'uploaded' && (
                  <button
                    onClick={() => handleCorrect(page.id)}
                    style={{ ...styles.smallButton, background: '#3498db', color: 'white' }}
                  >
                    开始矫正
                  </button>
                )}
                {page.status === 'corrected' && (
                  <button
                    onClick={() => handleSegment(page.id)}
                    style={{ ...styles.smallButton, background: '#27ae60', color: 'white' }}
                  >
                    开始分割
                  </button>
                )}
                {page.status === 'segmented' && (
                  <Link
                    to={`/annotate/${page.id}`}
                    style={{ ...styles.smallButton, background: '#9b59b6', color: 'white', textDecoration: 'none' }}
                  >
                    开始标注
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookDetail;
