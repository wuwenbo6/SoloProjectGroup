import React, { useState, useRef } from 'react';
import { Upload, Play, Download, Share2, Loader, Sparkles, Palette, Droplet, Wrench, X } from 'lucide-react';
import { photosAPI } from '../services/api';

function RepairStation() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [repairedUrl, setRepairedUrl] = useState(null);
  const [repairType, setRepairType] = useState('full');
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [currentRepairId, setCurrentRepairId] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const fileInputRef = useRef(null);

  const repairOptions = [
    { value: 'full', label: '全面修复', icon: Sparkles, description: '色彩校正+划痕去除+细节增强' },
    { value: 'color', label: '色彩校正', icon: Palette, description: '恢复胶片原有色彩' },
    { value: 'scratch', label: '划痕去除', icon: Wrench, description: '智能去除表面划痕' },
    { value: 'enhance', label: '细节增强', icon: Droplet, description: '增强边缘清晰度' },
  ];

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadedPhoto(null);
      setRepairedUrl(null);
      setShareUrl(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadedPhoto(null);
      setRepairedUrl(null);
      setShareUrl(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedPhoto(null);
    setRepairedUrl(null);
    setShareUrl(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await photosAPI.upload(formData);
      setUploadedPhoto(response.data);
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    }
  };

  const handleRepair = async () => {
    if (!uploadedPhoto) return;

    setIsRepairing(true);
    setRepairProgress(0);

    try {
      const response = await photosAPI.startRepair(uploadedPhoto.id, repairType, {});
      setCurrentRepairId(response.data.id);

      const pollInterval = setInterval(async () => {
        const statusResponse = await photosAPI.getRepairStatus(response.data.id);
        const repair = statusResponse.data;

        setRepairProgress(repair.progress);

        if (repair.status === 'completed') {
          clearInterval(pollInterval);
          const photoResponse = await photosAPI.getById(uploadedPhoto.id);
          setRepairedUrl(photoResponse.data.repaired_path);
          setIsRepairing(false);
          setCurrentRepairId(null);
        } else if (repair.status === 'failed') {
          clearInterval(pollInterval);
          setIsRepairing(false);
          setCurrentRepairId(null);
          alert('修复失败，请重试');
        }
      }, 1000);
    } catch (error) {
      console.error('修复失败:', error);
      setIsRepairing(false);
    }
  };

  const handleShare = async () => {
    if (!uploadedPhoto) return;

    try {
      const response = await photosAPI.share(uploadedPhoto.id);
      const fullUrl = `${window.location.origin}/share/${response.data.share_token}`;
      setShareUrl(fullUrl);
      await navigator.clipboard.writeText(fullUrl);
      alert('分享链接已复制！');
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  const handleDownload = async () => {
    if (repairedUrl) {
      try {
        const imageUrl = getImageUrl(repairedUrl);
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `restored_${uploadedPhoto.original_filename}`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('下载失败:', err);
        alert('下载失败，请稍后重试');
      }
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">照片修复操作台</h1>
        <p className="mt-2 text-gray-600 text-sm sm:text-base">上传您的老照片，AI智能修复，重现美好记忆</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-2xl hover:border-amber-400 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
                </div>
                <p className="text-base sm:text-lg font-medium text-gray-900">点击或拖拽上传照片</p>
                <p className="mt-2 text-xs sm:text-sm text-gray-500">支持 JPG、PNG 格式，最大 20MB</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">原图预览</h3>
                  {!uploadedPhoto && (
                    <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  <img src={previewUrl} alt="预览" className="w-full h-full object-contain" />
                </div>
                <p className="mt-3 text-xs sm:text-sm text-gray-500 truncate">{selectedFile.name}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">修复效果</h3>
                </div>
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  {repairedUrl ? (
                    <img src={getImageUrl(repairedUrl)} alt="修复后" className="w-full h-full object-contain" />
                  ) : isRepairing ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Loader className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-amber-500 mb-4" />
                      <p className="text-sm font-medium text-gray-900">修复中... {repairProgress}%</p>
                      <div className="w-32 sm:w-48 h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${repairProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mb-2" />
                      <p className="text-xs sm:text-sm">等待修复</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 sm:space-y-6">
          {selectedFile && !uploadedPhoto && (
            <button
              onClick={handleUpload}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              上传照片
            </button>
          )}

          {uploadedPhoto && !repairedUrl && !isRepairing && (
            <>
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <h3 className="font-medium text-gray-900 mb-4 text-sm sm:text-base">选择修复模式</h3>
                <div className="space-y-2 sm:space-y-3">
                  {repairOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRepairType(option.value)}
                      className={`w-full p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                        repairType === option.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <option.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          repairType === option.value ? 'text-amber-500' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium text-gray-900 text-xs sm:text-sm">{option.label}</div>
                          <div className="text-xs text-gray-500 hidden sm:block">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRepair}
                disabled={isRepairing}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                开始修复
              </button>
            </>
          )}

          {repairedUrl && (
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                下载修复后照片
              </button>
              <button
                onClick={handleShare}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                分享照片
              </button>
              <button
                onClick={handleClear}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                修复新照片
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

export default RepairStation;
