import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, X, ChevronLeft, Info, Check, RotateCw, Trash2, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMobile } from '../../hooks/useMobile'
import { useImageOptimizer } from '../../hooks/useImageOptimizer'
import LazyImage from '../../components/LazyImage'

interface CapturedImage {
  id: string
  url: string
  thumbnailUrl: string
  name: string
  width: number
  height: number
  size: number
  selected: boolean
  uploading: boolean
  uploadProgress: number
}

const MobileCapture: React.FC = () => {
  const navigate = useNavigate()
  const { isMobile, isPortrait, screenWidth, screenHeight } = useMobile()
  const { processImage } = useImageOptimizer()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [showInfo, setShowInfo] = useState(false)
  const [category, setCategory] = useState('')
  const [ethnicity, setEthnicity] = useState('')

  const ethnicities = [
    { value: 'miao', label: '苗族' },
    { value: 'yi', label: '彝族' },
    { value: 'zhuang', label: '壮族' },
    { value: 'dai', label: '傣族' },
    { value: 'tibetan', label: '藏族' },
    { value: 'other', label: '其他' },
  ]

  const categories = [
    { value: 'cloud', label: '云纹' },
    { value: 'water', label: '水纹' },
    { value: 'flower', label: '花卉纹' },
    { value: 'animal', label: '动物纹' },
    { value: 'geometric', label: '几何纹' },
    { value: 'batik', label: '蜡染纹' },
    { value: 'embroidery', label: '刺绣纹' },
    { value: 'brocade', label: '织锦纹' },
  ]

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (error) {
      console.error('Camera access failed:', error)
      alert('无法访问摄像头，请检查权限设置')
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    }
  }, [])

  const captureFromCamera = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `纹样拍摄_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const processed = await processImage(file)
        setCapturedImages(prev => [...prev, {
          ...processed,
          selected: false,
          uploading: false,
          uploadProgress: 0,
        }])
      }
    }, 'image/jpeg', 0.95)
  }, [processImage])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          const processed = await processImage(file)
          setCapturedImages(prev => [...prev, {
            ...processed,
            selected: false,
            uploading: false,
            uploadProgress: 0,
          }])
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processImage])

  const toggleSelectImage = useCallback((id: string) => {
    setCapturedImages(prev => prev.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    ))
  }, [])

  const selectAll = useCallback(() => {
    const allSelected = capturedImages.every(img => img.selected)
    setCapturedImages(prev => prev.map(img => ({ ...img, selected: !allSelected })))
  }, [capturedImages])

  const deleteSelected = useCallback(() => {
    setCapturedImages(prev => prev.filter(img => !img.selected))
  }, [])

  const uploadSelected = useCallback(async () => {
    const selectedImages = capturedImages.filter(img => img.selected)
    if (selectedImages.length === 0) {
      alert('请先选择要上传的图片')
      return
    }

    for (const image of selectedImages) {
      setCapturedImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, uploading: true, uploadProgress: 0 } : img
      ))

      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 50))
        setCapturedImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, uploadProgress: i } : img
        ))
      }

      setCapturedImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, uploading: false, uploadProgress: 100 } : img
      ))
    }

    alert(`成功上传 ${selectedImages.length} 张图片`)
  }, [capturedImages])

  const switchCamera = useCallback(() => {
    stopCamera()
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    setTimeout(startCamera, 300)
  }, [startCamera, stopCamera])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const selectedCount = capturedImages.filter(img => img.selected).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">纹样采集</h1>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            <Info size={24} className="text-gray-700" />
          </button>
        </div>
      </header>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
          <h4 className="font-medium text-amber-800 mb-2">采集提示</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• 确保纹样清晰，光线均匀，避免反光</li>
            <li>• 尽量完整拍摄整个纹样图案</li>
            <li>• 支持批量上传，可多选图片</li>
          </ul>
        </div>
      )}

      {/* Camera Preview */}
      {cameraActive ? (
        <div className="relative bg-black flex-1 min-h-[40vh]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ minHeight: '40vh' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent py-6">
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={switchCamera}
                className="p-4 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 active:bg-white/40"
              >
                <RotateCw size={28} className="text-white" />
              </button>
              <button
                onClick={captureFromCamera}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 border-4 border-red-vermilion rounded-full" />
              </button>
              <button
                onClick={stopCamera}
                className="p-4 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 active:bg-white/40"
              >
                <X size={28} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Action Buttons */
        <div className="p-4 space-y-3">
          <button
            onClick={startCamera}
            className="w-full py-4 bg-red-vermilion text-white rounded-xl flex items-center justify-center gap-2 active:bg-red-700 transition-colors shadow-md"
          >
            <Camera size={24} />
            <span className="font-medium">拍照采集</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 bg-gold-earth text-white rounded-xl flex items-center justify-center gap-2 active:bg-amber-700 transition-colors shadow-md"
          >
            <Upload size={24} />
            <span className="font-medium">从相册选择</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Category & Ethnicity Selection */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">纹样分类</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-red-vermilion focus:border-transparent"
          >
            <option value="">请选择分类</option>
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">所属民族</label>
          <select
            value={ethnicity}
            onChange={(e) => setEthnicity(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-red-vermilion focus:border-transparent"
          >
            <option value="">请选择民族</option>
            {ethnicities.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Captured Images Grid */}
      {capturedImages.length > 0 && (
        <div className="px-4 pb-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">
              已采集 ({capturedImages.length})
              {selectedCount > 0 && (
                <span className="text-red-vermilion ml-2">
                  已选 {selectedCount} 张
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-sm text-gold-earth font-medium"
              >
                全选
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={deleteSelected}
                  className="text-sm text-red-vermilion font-medium flex items-center gap-1"
                >
                  <Trash2 size={16} />
                  删除
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {capturedImages.map((image) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-200"
              >
                <LazyImage
                  src={image.thumbnailUrl}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => toggleSelectImage(image.id)}
                  className={`absolute top-1 left-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    image.selected
                      ? 'bg-red-vermilion border-red-vermilion'
                      : 'bg-white/80 border-gray-400'
                  }`}
                >
                  {image.selected && <Check size={14} className="text-white" />}
                </button>
                {image.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-sm font-medium">
                      {image.uploadProgress}%
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {capturedImages.length > 0 && selectedCount > 0 && (
        <div className="p-4 bg-white border-t border-gray-200 sticky bottom-0 safe-area-bottom">
          <button
            onClick={uploadSelected}
            disabled={capturedImages.some(img => img.uploading)}
            className="w-full py-4 bg-indigo-dark text-white rounded-xl flex items-center justify-center gap-2 active:bg-indigo-900 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
            <span className="font-medium">
              上传 {selectedCount} 张纹样
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export default MobileCapture
