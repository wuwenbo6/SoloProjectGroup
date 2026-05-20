import React, { useState, useEffect } from 'react';
import { tagsAPI, archiveAPI } from '../services/api';

const TagManager: React.FC = () => {
  const [tags, setTags] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#3b82f6', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tagsRes, statsRes, photosRes] = await Promise.all([
        tagsAPI.getAll(),
        tagsAPI.getStats(),
        archiveAPI.listPhotos()
      ]);
      setTags(tagsRes.data);
      setStats(statsRes.data);
      setPhotos(photosRes.data?.photos || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) return;
    setLoading(true);
    try {
      await tagsAPI.create(newTag);
      setShowCreateModal(false);
      setNewTag({ name: '', color: '#3b82f6', description: '' });
      await loadData();
    } catch (error) {
      console.error('创建标签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('确定要删除此标签吗？')) return;
    try {
      await tagsAPI.delete(tagId);
      await loadData();
    } catch (error) {
      console.error('删除标签失败:', error);
    }
  };

  const handleAddTagsToPhoto = async (photoId: number) => {
    if (selectedPhotos.length === 0) return;
    try {
      await tagsAPI.addToPhoto(photoId, selectedPhotos);
      await loadData();
      setSelectedPhotos([]);
    } catch (error) {
      console.error('添加标签失败:', error);
    }
  };

  const handleAutoTag = async (type: 'film' | 'camera') => {
    try {
      if (type === 'film') {
        await tagsAPI.autoTagByFilmType();
      } else {
        await tagsAPI.autoTagByCamera();
      }
      await loadData();
      alert('自动标记完成');
    } catch (error) {
      console.error('自动标记失败:', error);
    }
  };

  const handleTagClick = async (tagId: number) => {
    setSelectedTag(tagId);
    try {
      const res = await tagsAPI.getPhotosByTag(tagId);
      setPhotos(res.data?.photos || []);
    } catch (error) {
      console.error('加载标签照片失败:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 className="page-title">标签管理</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>标签列表</h3>
              <button 
                className="btn btn-primary" 
                style={{ padding: '6px 12px', fontSize: '14px' }}
                onClick={() => setShowCreateModal(true)}
              >
                + 新建
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '12px' }}
                onClick={() => handleAutoTag('film')}
              >
                按胶片类型
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '12px' }}
                onClick={() => handleAutoTag('camera')}
              >
                按设备
              </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {tags.map(tag => (
                <div
                  key={tag.id}
                  onClick={() => handleTagClick(tag.id)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    background: selectedTag === tag.id ? 'rgba(59, 130, 246, 0.2)' : '#1a1a2e',
                    border: `2px solid ${tag.color}`,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: tag.color }} />
                      <span style={{ fontWeight: 500 }}>{tag.name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                      {tag.photo_count} 张照片
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTag(tag.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {stats && (
            <div className="card" style={{ marginTop: '16px' }}>
              <h3>统计信息</h3>
              <div style={{ fontSize: '14px' }}>
                <p>总标签数: <strong>{stats.total_tags}</strong></p>
                <p>总照片数: <strong>{stats.total_photos}</strong></p>
                <p>已标记: <strong>{stats.tagged_photos}</strong></p>
                <p>未标记: <strong>{stats.untagged_photos}</strong></p>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>
            {selectedTag 
              ? `标签照片 - ${tags.find(t => t.id === selectedTag)?.name || ''}` 
              : '所有照片'
            }
          </h3>
          
          <button
            className="btn btn-secondary"
            style={{ marginBottom: '16px' }}
            onClick={() => {
              setSelectedTag(null);
              loadData();
            }}
          >
            显示全部
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {photos.map((photo: any) => (
              <div
                key={photo.id}
                style={{
                  background: '#1a1a2e',
                  borderRadius: '8px',
                  padding: '12px',
                  border: selectedPhotos.includes(photo.id) ? '2px solid #3b82f6' : 'none'
                }}
              >
                <div style={{
                  width: '100%',
                  height: '120px',
                  background: '#2d2d44',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: '#666', fontSize: '24px' }}>📷</span>
                </div>
                <p style={{ fontSize: '13px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photo.filename}
                </p>
                <p style={{ fontSize: '12px', color: '#888' }}>{photo.film_type || '未知'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '400px' }}>
            <h3>创建新标签</h3>
            <div className="form-group">
              <label>标签名称</label>
              <input
                type="text"
                value={newTag.name}
                onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="输入标签名称"
              />
            </div>
            <div className="form-group">
              <label>标签颜色</label>
              <input
                type="color"
                value={newTag.color}
                onChange={e => setNewTag({ ...newTag, color: e.target.value })}
                style={{ height: '40px', cursor: 'pointer' }}
              />
            </div>
            <div className="form-group">
              <label>描述（可选）</label>
              <input
                type="text"
                value={newTag.description}
                onChange={e => setNewTag({ ...newTag, description: e.target.value })}
                placeholder="输入标签描述"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleCreateTag}
                disabled={loading}
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManager;
