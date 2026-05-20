import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Image, X, CheckCircle2 } from 'lucide-react';
import useStore from '../store';
import { imageAPI } from '../services/api';

const UploadPage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { images, setImages } = useStore();
  const navigate = useNavigate();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', file.name);

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }));
        const newImage = await imageAPI.upload(formData);
        setImages([...images, newImage]);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
      }
    }

    setTimeout(() => {
      setFiles([]);
      setUploading(false);
      setUploadProgress({});
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-serif">图像上传</h1>
        <p className="text-gray-600 mt-2">上传古籍碑文图片进行OCR识别与标注</p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-amber-500 transition-all bg-white"
      >
        <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">拖放图片到这里</p>
        <p className="text-gray-500 mb-4">或点击选择文件</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <span className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg cursor-pointer transition-all inline-block">
            选择文件
          </span>
        </label>
        <p className="text-sm text-gray-400 mt-4">支持 JPG、PNG、GIF 格式</p>
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">待上传文件 ({files.length})</h2>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-all"
            >
              {uploading ? '上传中...' : '开始上传'}
            </button>
          </div>

          <div className="space-y-3">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadProgress[file.name] !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          uploadProgress[file.name] === 100
                            ? 'bg-green-500'
                            : uploadProgress[file.name] === -1
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(0, uploadProgress[file.name])}%` }}
                      />
                    </div>
                  )}
                </div>
                {uploadProgress[file.name] === 100 ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    disabled={uploading}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">已上传图片</h2>
        {images.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无上传的图片</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.slice(0, 12).map((image: any) => (
              <div
                key={image.id}
                onClick={() => navigate(`/annotate/${image.id}`)}
                className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all group"
              >
                {image.thumbnail_path ? (
                  <img
                    src={`/uploads/${image.thumbnail_path}`}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
