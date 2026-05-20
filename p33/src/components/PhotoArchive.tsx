import React, { useState, useEffect } from 'react';
import { archiveAPI } from '../services/api';

interface Photo {
  id: number;
  filename: string;
  file_format: string;
  width: number;
  height: number;
  file_size?: number;
  camera_model?: string;
  film_type?: string;
  scan_date?: string;
  tags?: string;
  notes?: string;
  has_restoration?: boolean;
}

const PhotoArchive: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState({
    camera_model: '',
    film_type: '',
    tags: ''
  });
  const [uploading, setUploading] = useState(false);

  const loadPhotos = async () => {
    try {
      const response = await archiveAPI.listPhotos({
        page,
        page_size: 20,
        ...search
      });
      setPhotos(response.data.photos || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('加载照片失败:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await archiveAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  useEffect(() => {
    loadPhotos();
    loadStats();
  }, [page, search]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await archiveAPI.importPhoto(files[i], {
          camera_model: '未知',
          film_type: '未知'
        });
      }
      await loadPhotos();
      await loadStats();
      alert('上传成功');
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此照片吗？')) return;
    try {
      await archiveAPI.deletePhoto(id);
      await loadPhotos();
      await loadStats();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleDownload = async (photo: Photo, format: string) => {
    try {
      const response = await archiveAPI.downloadPhoto(photo.id, format);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${photo.filename.split('.')[0]}.${format}`;
      link.click();
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="page-title">本地照片档案管理</h2>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <h3 style={{ color: '#e94560', fontSize: '2rem' }}>{stats.total_photos}</h3>
            <p>照片总数</p>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <h3 style={{ color: '#e94560', fontSize: '2rem' }}>{stats.total_size_mb}</h3>
            <p>存储空间 (MB)</p>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <h3 style={{ color: '#e94560', fontSize: '2rem' }}>{stats.camera_models?.length || 0}</h3>
            <p>相机型号</p>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <h3 style={{ color: '#e94560', fontSize: '2rem' }}>{stats.film_types?.length || 0}</h3>
            <p>胶片类型</p>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: '0.5rem' }}>相机型号:</label>
            <input
              type="text"
              value={search.camera_model}
              onChange={e => setSearch(prev => ({ ...prev, camera_model: e.target.value }))}
              placeholder="输入相机型号"
              style={{ padding: '0.5rem', width: '150px' }}
            />
          </div>
          <div>
            <label style={{ marginRight: '0.5rem' }}>胶片类型:</label>
            <input
              type="text"
              value={search.film_type}
              onChange={e => setSearch(prev => ({ ...prev, film_type: e.target.value }))}
              placeholder="输入胶片类型"
              style={{ padding: '0.5rem', width: '150px' }}
            />
          </div>
          <div>
            <label style={{ marginRight: '0.5rem' }}>标签:</label>
            <input
              type="text"
              value={search.tags}
              onChange={e => setSearch(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="输入标签"
              style={{ padding: '0.5rem', width: '150px' }}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
              {uploading ? '上传中...' : '导入照片'}
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>照片列表</h3>
          <span>共 {total} 张照片</span>
        </div>

        {photos.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>暂无照片</p>
        ) : (
          <div className="grid">
            {photos.map(photo => (
              <div 
                key={photo.id} 
                className="grid-item"
                onClick={() => setSelectedPhoto(photo)}
              >
                <div style={{ height: '150px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#666', fontSize: '0.8rem' }}>{photo.filename}</span>
                </div>
                <div className="grid-item-info">
                  <h4 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.filename}</h4>
                  <p>{photo.camera_model || '未知相机'} | {photo.film_type || '未知胶片'}</p>
                  <p>{photo.width}x{photo.height} | {photo.file_format.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一页
            </button>
            <span style={{ padding: '0.5rem 1rem' }}>第 {page} / {totalPages} 页</span>
            <button 
              className="btn btn-secondary" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setSelectedPhoto(null)}>
          <div className="card" style={{ width: '600px', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>照片详情</h3>
              <button onClick={() => setSelectedPhoto(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
            </div>
            
            <div style={{ background: '#000', padding: '1rem', textAlign: 'center', marginBottom: '1rem' }}>
              <p style={{ color: '#666' }}>{selectedPhoto.filename}</p>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>{selectedPhoto.width}x{selectedPhoto.height} | {selectedPhoto.file_format.toUpperCase()}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem' }}>相机型号</label>
                <p>{selectedPhoto.camera_model || '未知'}</p>
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem' }}>胶片类型</label>
                <p>{selectedPhoto.film_type || '未知'}</p>
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem' }}>标签</label>
                <p>{selectedPhoto.tags || '无'}</p>
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem' }}>扫描日期</label>
                <p>{selectedPhoto.scan_date ? new Date(selectedPhoto.scan_date).toLocaleDateString() : '未知'}</p>
              </div>
            </div>

            <h4 style={{ marginBottom: '0.5rem' }}>下载格式</h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => handleDownload(selectedPhoto, 'jpeg')}>JPEG</button>
              <button className="btn btn-secondary" onClick={() => handleDownload(selectedPhoto, 'png')}>PNG</button>
              <button className="btn btn-secondary" onClick={() => handleDownload(selectedPhoto, 'tiff')}>TIFF</button>
            </div>

            <button 
              className="btn" 
              style={{ background: '#dc3545', width: '100%' }}
              onClick={() => {
                handleDelete(selectedPhoto.id);
                setSelectedPhoto(null);
              }}
            >
              删除照片
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoArchive;
