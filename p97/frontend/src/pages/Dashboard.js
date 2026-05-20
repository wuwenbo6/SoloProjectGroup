import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityAPI, exportAPI } from '../services/api';

function Dashboard({ user }) {
  const [activities, setActivities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    category: '节日庆典'
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const categories = ['节日庆典', '传统技艺', '民俗表演', '美食文化', '其他'];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadMyActivities();
  }, [user]);

  const loadMyActivities = async () => {
    try {
      const res = await activityAPI.getAll({ userId: user.id });
      setActivities(res.data);
    } catch (err) {
      console.error('加载活动失败:', err);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      alert('最多上传5张图片');
      return;
    }
    setImages(prev => [...prev, ...files]);
    
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const handleVideoChange = (e) => {
    const files = Array.from(e.target.files);
    if (videos.length + files.length > 2) {
      alert('最多上传2个视频');
      return;
    }
    
    const validVideos = files.filter(file => {
      if (file.size > 500 * 1024 * 1024) {
        alert(`视频 ${file.name} 超过500MB限制`);
        return false;
      }
      return true;
    });
    
    setVideos(prev => [...prev, ...validVideos]);
    
    const urls = validVideos.map(file => URL.createObjectURL(file));
    setVideoPreviews(prev => [...prev, ...urls]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
    setVideoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('请输入活动标题');
      return;
    }
    
    setUploading(true);
    
    try {
      const formDataObj = new FormData();
      formDataObj.append('userId', user.id);
      formDataObj.append('title', formData.title.trim());
      formDataObj.append('description', formData.description);
      formDataObj.append('location', formData.location);
      formDataObj.append('date', formData.date);
      formDataObj.append('category', formData.category);
      
      images.forEach(img => {
        formDataObj.append('images', img);
      });
      
      videos.forEach(vid => {
        formDataObj.append('videos', vid);
      });

      await activityAPI.create(formDataObj);
      setShowForm(false);
      setFormData({ title: '', description: '', location: '', date: '', category: '节日庆典' });
      setImages([]);
      setVideos([]);
      setPreviewUrls([]);
      setVideoPreviews([]);
      loadMyActivities();
    } catch (err) {
      console.error('创建活动失败:', err);
      alert(err.response?.data?.error || '创建失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这个活动吗？')) {
      try {
        await activityAPI.delete(id);
        loadMyActivities();
      } catch (err) {
        console.error('删除失败:', err);
      }
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await exportAPI.exportActivities(format, { userId: user.id });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `my_activities_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('导出失败:', err);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>🎛️ 我的操作台</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '取消' : '+ 发布新活动'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
            <div className="form-group">
              <label>活动标题 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="请输入活动名称"
              />
            </div>

            <div className="form-group">
              <label>活动描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                placeholder="请详细描述这个民俗活动"
              />
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label>活动地点</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="例如：北京故宫"
                />
              </div>
              <div>
                <label>活动日期</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>活动分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>上传图片（最多5张）</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                style={{ padding: '10px' }}
              />
              {previewUrls.length > 0 && (
                <div className="image-preview">
                  {previewUrls.map((url, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img src={url} alt={`preview-${index}`} />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#ff4757',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>上传视频（最多2个，单文件500MB以内）</label>
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={handleVideoChange}
                style={{ padding: '10px' }}
              />
              {videoPreviews.length > 0 && (
                <div className="image-preview">
                  {videoPreviews.map((url, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <video 
                        src={url} 
                        style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#ff4757',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? '上传中...' : '发布活动'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3>我发布的活动</h3>
          <div className="export-btn-group">
            <button 
              className="btn btn-secondary" 
              onClick={() => handleExport('json')}
              disabled={exporting || activities.length === 0}
            >
              📄 导出 JSON
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleExport('csv')}
              disabled={exporting || activities.length === 0}
            >
              📊 导出 CSV
            </button>
          </div>
        </div>
        
        {activities.length === 0 ? (
          <div className="empty-state">
            <h3>还没有发布任何活动</h3>
            <p>点击上方按钮发布第一个民俗活动吧！</p>
          </div>
        ) : (
          <div className="grid">
            {activities.map(activity => (
              <div key={activity.id} className="activity-card">
                <div style={{ position: 'relative' }}>
                  {activity.images && activity.images.length > 0 ? (
                    <img 
                      src={`http://localhost:3001${activity.images[0]}`}
                      alt={activity.title}
                      className="activity-image"
                    />
                  ) : activity.videos && activity.videos.length > 0 ? (
                    <video 
                      src={`http://localhost:3001${activity.videos[0]}`}
                      className="activity-image"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="activity-image" style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '60px'
                    }}>
                      🎎
                    </div>
                  )}
                  {activity.videos && activity.videos.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      🎥 {activity.videos.length}
                    </div>
                  )}
                </div>
                <div className="activity-content">
                  <span className="category-tag">{activity.category || '其他'}</span>
                  <h3 className="activity-title">{activity.title}</h3>
                  <div className="activity-meta">
                    <span>📍 {activity.location || '未知'}</span>
                    <span>📅 {activity.date || '待定'}</span>
                  </div>
                  <div className="actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => navigate(`/activity/${activity.id}`)}
                    >
                      查看详情
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleDelete(activity.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
