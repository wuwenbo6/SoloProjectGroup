import React, { useState, useRef, useEffect } from 'react'
import { Camera, Upload, FolderOpen, Trash2, ChevronRight, X, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import CameraCapture from '../../components/CameraCapture'
import LazyImage from '../../components/LazyImage'
import { useImageOptimizer, ProcessedImage } from '../../hooks/useImageOptimizer'

const Capture: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [capturedImages, setCapturedImages] = useState<ProcessedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null)

  const { processing, processImage, processImages, releaseObjectUrl } = useImageOptimizer()

  useEffect(() => {
    return () => {
      capturedImages.forEach(img => {
        releaseObjectUrl(img.originalUrl)
        releaseObjectUrl(img.thumbnailUrl)
        if (img.webpUrl) releaseObjectUrl(img.webpUrl)
      })
    }
  }, [capturedImages, releaseObjectUrl])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
      setProcessingProgress({ current: 0, total: validFiles.length })
      
      const processed = await processImages(validFiles, (current, total) => {
        setProcessingProgress({ current, total })
      })
      
      setCapturedImages(prev => [...prev, ...processed])
      setProcessingProgress(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
      setProcessingProgress({ current: 0, total: validFiles.length })
      
      const processed = await processImages(validFiles, (current, total) => {
        setProcessingProgress({ current, total })
      })
      
      setCapturedImages(prev => [...prev, ...processed])
      setProcessingProgress(null)
    }
  }

  const handleCameraCapture = async (imageData: string) => {
    const response = await fetch(imageData)
    const blob = await response.blob()
    const file = new File([blob], `纹样拍摄_${Date.now()}.jpg`, { type: 'image/jpeg' })
    const processed = await processImage(file)
    
    setCapturedImages(prev => [...prev, processed])
    setShowCamera(false)
  }

  const removeImage = (id: string) => {
    setCapturedImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleUpload = async () => {
    setUploading(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setUploading(false)
    alert('上传成功！')
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-indigo-dark">纹样采集</h1>
          <p className="text-gray-500 mt-2">上传或拍摄传统纹样图片</p>
        </div>
        <button
          onClick={handleUpload}
          disabled={capturedImages.length === 0 || uploading}
          className="btn-primary flex items-center gap-2"
        >
          {uploading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Upload size={20} />
          )}
          {uploading ? '上传中...' : '批量上传'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        <div className="lg:col-span-2 space-y-6">
          <div
            className={`card border-2 border-dashed transition-colors h-80 flex flex-col items-center justify-center ${
              dragActive ? 'border-red-vermilion bg-red-vermilion/5' : 'border-gray-300'
            } ${processing ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {processing && processingProgress ? (
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-gold-earth/30 border-t-gold-earth rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg font-medium text-gray-700 mb-2">正在处理图片...</p>
                <p className="text-gray-500">{processingProgress.current} / {processingProgress.total}</p>
                <div className="w-48 h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gold-earth rounded-full transition-all duration-300"
                    style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-gold-earth/10 rounded-full flex items-center justify-center mb-4">
                  <Camera className="text-gold-earth" size={40} />
                </div>
                <p className="text-lg font-medium text-gray-700 mb-2">拖拽图片到这里</p>
                <p className="text-gray-400 mb-6">或者点击下方按钮选择文件</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <FolderOpen size={20} />
                    选择文件
                  </button>
                  <button
                    onClick={() => setShowCamera(true)}
                    className="btn-outline flex items-center gap-2"
                  >
                    <Camera size={20} />
                    调用相机
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-bold text-indigo-dark">
                待上传列表 ({capturedImages.length})
              </h2>
              {capturedImages.length > 0 && (
                <button
                  onClick={() => setCapturedImages([])}
                  className="text-sm text-red-vermilion hover:underline"
                >
                  清空全部
                </button>
              )}
            </div>

            {capturedImages.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>暂无待上传的图片</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {capturedImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <LazyImage
                        src={image.thumbnailUrl}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/editor/${image.id}`}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-lg"
                        title="编辑"
                      >
                        <ChevronRight size={14} className="text-gray-800" />
                      </Link>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="p-2 bg-red-vermilion rounded-full hover:bg-red-700 shadow-lg"
                        title="删除"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-700 font-medium truncate">{image.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <Info size={12} />
                        <span>{image.width} × {image.height}</span>
                        <span>·</span>
                        <span>{(image.size / 1024).toFixed(1)} KB</span>
                        {image.webpUrl && (
                          <>
                            <span>·</span>
                            <span className="text-green-600">WebP</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-medium text-indigo-dark mb-4">采集指南</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-gold-earth/20 rounded-full flex items-center justify-center text-gold-earth text-xs flex-shrink-0">
                  1
                </span>
                确保纹样清晰，光线均匀，避免反光
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-gold-earth/20 rounded-full flex items-center justify-center text-gold-earth text-xs flex-shrink-0">
                  2
                </span>
                尽量完整拍摄整个纹样图案
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-gold-earth/20 rounded-full flex items-center justify-center text-gold-earth text-xs flex-shrink-0">
                  3
                </span>
                推荐分辨率：1920x1080 或更高
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-gold-earth/20 rounded-full flex items-center justify-center text-gold-earth text-xs flex-shrink-0">
                  4
                </span>
                支持格式：JPG, PNG, WebP
              </li>
            </ul>
          </div>

          <div className="card">
            <h3 className="font-medium text-indigo-dark mb-4">纹样分类</h3>
            <div className="space-y-2">
              {['云纹', '水纹', '花卉纹', '动物纹', '几何纹', '蜡染纹', '刺绣纹', '织锦纹'].map(
                (category) => (
                  <label
                    key={category}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input type="checkbox" className="rounded text-red-vermilion focus:ring-red-vermilion" />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                )
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium text-indigo-dark mb-4">民族选择</h3>
            <select className="input-field">
              <option value="">请选择民族</option>
              <option value="miao">苗族</option>
              <option value="yi">彝族</option>
              <option value="zhuang">壮族</option>
              <option value="dai">傣族</option>
              <option value="tibetan">藏族</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

export default Capture
