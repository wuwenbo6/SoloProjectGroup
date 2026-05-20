import React, { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Trash2, Share2, Download, Clock, Loader, RefreshCw, Film, FileSpreadsheet, Search } from 'lucide-react';
import { photosAPI } from '../services/api';

function Album() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showFilmStyleModal, setShowFilmStyleModal] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [similarPhotos, setSimilarPhotos] = useState([]);
  const [filmStyles, setFilmStyles] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('classic');
  const [styleOptions, setStyleOptions] = useState({
    grain: 0.2,
    vignette: 0.2,
    soft_focus: false,
    border: false
  });
  const [applyingStyle, setApplyingStyle] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await photosAPI.getAll();
      setPhotos(response.data || []);
      localStorage.setItem('cachedPhotos', JSON.stringify(response.data || []));
    } catch (error) {
      console.error('加载相册失败:', error);
      const cached = localStorage.getItem('cachedPhotos');
      if (cached) {
        setPhotos(JSON.parse(cached));
        setError('网络异常，显示缓存数据');
      } else {
        setError('加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
    loadFilmStyles();
  }, [loadPhotos]);

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const normalizedPath = path.replace(/\\/g, '/');
    const uploadsIndex = normalizedPath.indexOf('uploads/');
    if (uploadsIndex >= 0) {
      return `/${normalizedPath.substring(uploadsIndex)}`;
    }
    return `/uploads/${normalizedPath.split('/').pop()}`;
  };

  const loadFilmStyles = async () => {
    try {
      const response = await photosAPI.getFilmStyles();
      setFilmStyles(response.data);
    } catch (err) {
      console.error('加载胶片样式失败:', err);
    }
  };

  const handleApplyFilmStyle = async () => {
    if (!selectedPhoto) return;
    setApplyingStyle(true);
    try {
      await photosAPI.applyFilmStyle(selectedPhoto.id, {
        style: selectedStyle,
        grain: styleOptions.grain,
        vignette: styleOptions.vignette,
        soft_focus: styleOptions.soft_focus,
        border: styleOptions.border
      });
      await loadPhotos();
      setShowFilmStyleModal(false);
      alert('胶片风格应用成功！');
    } catch (err) {
      console.error('应用胶片风格失败:', err);
      alert('应用失败，请重试');
    } finally {
      setApplyingStyle(false);
    }
  };

  const handleExportRecords = async (format = 'json') => {
    try {
      const response = await photosAPI.exportRepairRecords(format);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `repair_records.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('导出记录失败:', err);
      alert('导出失败，请重试');
    }
  };

  const handleFindSimilar = async (photo) => {
    setSelectedPhoto(photo);
    try {
      const response = await photosAPI.getSimilarPhotos(photo.id, 5);
      setSimilarPhotos(response.data || []);
      setShowSimilarModal(true);
    } catch (err) {
      console.error('查找相似照片失败:', err);
      alert('查找失败，请重试');
    }
  };

  const handleDelete = async (photo, e) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这张照片吗？')) return;
    try {
      await photosAPI.delete(photo.id);
      loadPhotos();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleShare = async (photo, e) => {
    e.stopPropagation();
    try {
      const response = await photosAPI.share(photo.id);
      const fullUrl = `${window.location.origin}/share/${response.data.share_token}`;
      await navigator.clipboard.writeText(fullUrl);
      alert('分享链接已复制到剪贴板！');
    } catch (error) {
      console.error('分享失败:', error);
      alert('分享失败，请重试');
    }
  };

  const handleDownload = async (photo, e) => {
    e.stopPropagation();
    try {
      const imageUrl = getImageUrl(photo.repaired_path || photo.original_path);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restored_${photo.original_filename}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败:', err);
      alert('下载失败，请稍后重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader className="w-10 h-10 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">我的相册</h1>
          <p className="mt-1 text-gray-600">共 {photos.length} 张照片</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadPhotos}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">刷新</span>
          </button>
          <button
            onClick={() => handleExportRecords('json')}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">导出记录</span>
          </button>
          <button
            onClick={() => handleExportRecords('csv')}
            className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">导出CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-800 text-sm">{error}</p>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无照片</h3>
          <p className="text-gray-500">上传您的第一张照片开始修复吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group"
            >
              <div className="relative aspect-square bg-gray-100">
                <img
                  src={getImageUrl(photo.thumbnail_path || photo.repaired_path || photo.original_path)}
                  alt={photo.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = getImageUrl(photo.repaired_path || photo.original_path);
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex flex-wrap gap-2 justify-center p-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo); setShowFilmStyleModal(true); }}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow"
                      title="应用胶片风格"
                    >
                      <Film className="w-4 h-4 text-amber-600" />
                    </button>
                    <button
                      onClick={(e) => handleFindSimilar(photo)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow"
                      title="查找相似照片"
                    >
                      <Search className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => handleDownload(photo, e)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow"
                      title="下载"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={(e) => handleShare(photo, e)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow"
                      title="分享"
                    >
                      <Share2 className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(photo, e)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-medium text-gray-900 truncate text-sm sm:text-base">{photo.title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">{photo.original_filename}</p>
                <div className="flex items-center mt-2 text-xs sm:text-sm text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{new Date(photo.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showFilmStyleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">应用胶片风格</h2>
              <p className="text-sm text-gray-500 mt-1">为您的照片添加复古胶片效果</p>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">选择风格</label>
                <div className="grid grid-cols-2 gap-3">
                  {filmStyles?.styles?.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedStyle === style.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900 text-sm">{style.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  胶片颗粒强度: {(styleOptions.grain * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={styleOptions.grain}
                  onChange={(e) => setStyleOptions({ ...styleOptions, grain: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  暗角强度: {(styleOptions.vignette * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={styleOptions.vignette}
                  onChange={(e) => setStyleOptions({ ...styleOptions, vignette: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleOptions.soft_focus}
                    onChange={(e) => setStyleOptions({ ...styleOptions, soft_focus: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="text-sm text-gray-700">柔焦效果</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleOptions.border}
                    onChange={(e) => setStyleOptions({ ...styleOptions, border: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="text-sm text-gray-700">复古边框</span>
                </label>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t flex gap-3">
              <button
                onClick={() => setShowFilmStyleModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleApplyFilmStyle}
                disabled={applyingStyle}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {applyingStyle && <Loader className="w-4 h-4 animate-spin" />}
                应用效果
              </button>
            </div>
          </div>
        </div>
      )}

      {showSimilarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">相似照片</h2>
              <p className="text-sm text-gray-500 mt-1">基于色彩相似度查找</p>
            </div>
            <div className="p-4 sm:p-6">
              {similarPhotos.length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">未找到相似照片</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {similarPhotos.map((photo) => (
                    <div key={photo.photo_id} className="group relative">
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img
                          src={getImageUrl(photo.thumbnail_path)}
                          alt={photo.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                        {photo.similarity}% 相似
                      </div>
                      <p className="mt-2 text-sm text-gray-700 truncate">{photo.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t">
              <button
                onClick={() => setShowSimilarModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Album;
