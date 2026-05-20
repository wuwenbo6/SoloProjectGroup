import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, Download, Loader, ArrowLeft, ExternalLink } from 'lucide-react';
import { photosAPI } from '../services/api';

function Share() {
  const { token } = useParams();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadSharedPhoto();
  }, [token]);

  const loadSharedPhoto = async () => {
    try {
      const response = await photosAPI.getShared(token);
      setPhoto(response.data);
      setImageError(false);
    } catch (err) {
      setError('照片不存在或链接已失效');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDownload = async () => {
    if (photo) {
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
          <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 text-white">
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Camera className="w-6 h-6 text-primary-400" />
            <span className="text-white font-medium">胶片照片修复</span>
          </div>
          <div className="w-16" />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          <div className="flex-1 max-w-2xl">
            <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              {imageError ? (
                <div className="w-full aspect-video flex flex-col items-center justify-center text-gray-500">
                  <Camera className="w-16 h-16 mb-4" />
                  <p>图片加载失败</p>
                </div>
              ) : (
                <img
                  src={getImageUrl(photo.repaired_path || photo.original_path)}
                  alt={photo.title}
                  className="w-full h-auto"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          </div>

          <div className="w-full lg:w-80">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h1 className="text-xl font-bold text-white mb-2">{photo.title}</h1>
              {photo.description && (
                <p className="text-gray-400 text-sm mb-4">{photo.description}</p>
              )}

              <div className="space-y-3 mb-6">
                {photo.repaired_path && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm">已修复</span>
                  </div>
                )}
                <div className="text-gray-500 text-sm">
                  文件名: {photo.original_filename}
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full flex justify-center items-center space-x-2 py-3 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                <Download className="w-5 h-5" />
                <span>下载照片</span>
              </button>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-gray-500 text-sm text-center">
                  这是别人分享给您的照片
                </p>
                <p className="text-gray-600 text-xs text-center mt-2">
                  想要修复您自己的老照片？
                  <Link to="/register" className="text-primary-400 hover:text-primary-300 ml-1">
                    立即注册
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Share;
