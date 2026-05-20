import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Map as MapIcon, FileImage } from 'lucide-react';
import { api } from '../services/api';

function MapList() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      const data = await api.getMaps();
      setMaps(data);
    } catch (error) {
      console.error('加载地图失败:', error);
    }
  };

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await api.uploadMap(file, file.name);
      setMaps(prev => [result, ...prev]);
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="map-list">
      <h2>我的地图</h2>
      
      <div className="upload-section">
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          {uploading ? (
            <div>
              <Upload size={48} style={{ margin: '0 auto 16px', animation: 'pulse 1.5s infinite' }} />
              <p style={{ fontSize: '16px', color: '#7f8c8d' }}>上传中...</p>
            </div>
          ) : (
            <>
              <FileImage size={48} style={{ margin: '0 auto 16px', color: '#7f8c8d' }} />
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                点击或拖放上传地图扫描件
              </p>
              <p style={{ fontSize: '14px', color: '#7f8c8d' }}>
                支持 JPG、PNG、TIFF 等图片格式
              </p>
            </>
          )}
        </div>
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {maps.length === 0 ? (
        <div className="empty-state">
          <MapIcon size={64} />
          <p style={{ fontSize: '16px', marginTop: '16px' }}>还没有上传的地图</p>
          <p style={{ fontSize: '14px', color: '#7f8c8d' }}>上传第一个地图开始标注吧</p>
        </div>
      ) : (
        <div className="maps-grid">
          {maps.map((map) => (
            <div
              key={map.id}
              className="map-card"
              onClick={() => navigate(`/map/${map.id}`)}
            >
              <img
                src={map.url}
                alt={map.name}
                className="map-card-thumbnail"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="map-card-info">
                <div className="map-card-title">{map.name}</div>
                <div className="map-card-date">
                  上传于 {formatDate(map.upload_date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapList;
