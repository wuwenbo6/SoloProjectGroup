import React, { useState, useRef, useEffect } from 'react'
import { Camera, X, RotateCw, Crop, Check, Video, VideoOff } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (imageData: string) => void
  onClose: () => void
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isReady, setIsReady] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 400, height: 400 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [facingMode])

  const startCamera = async () => {
    try {
      stopCamera()
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => setIsReady(true)
      }
    } catch (error) {
      console.error('Camera access failed:', error)
      alert('无法访问相机，请检查权限设置')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsReady(false)
  }

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !isReady) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    setCapturedImage(imageData)
    stopCamera()
  }

  const retake = () => {
    setCapturedImage(null)
    setCropMode(false)
    startCamera()
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDragStart({
      x: e.clientX - rect.left - cropArea.x,
      y: e.clientY - rect.top - cropArea.y,
    })
    setIsDragging(true)
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !cropMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const newX = Math.max(0, Math.min(e.clientX - rect.left - dragStart.x, rect.width - cropArea.width))
    const newY = Math.max(0, Math.min(e.clientY - rect.top - dragStart.y, rect.height - cropArea.height))
    setCropArea((prev) => ({ ...prev, x: newX, y: newY }))
  }

  const handleCropMouseUp = () => {
    setIsDragging(false)
  }

  const applyCrop = () => {
    if (!capturedImage || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const scaleX = img.width / 500
      const scaleY = img.height / 500

      canvas.width = cropArea.width * scaleX
      canvas.height = cropArea.height * scaleY

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        img,
        cropArea.x * scaleX,
        cropArea.y * scaleY,
        cropArea.width * scaleX,
        cropArea.height * scaleY,
        0,
        0,
        cropArea.width * scaleX,
        cropArea.height * scaleY
      )

      const croppedImage = canvas.toDataURL('image/jpeg', 0.95)
      onCapture(croppedImage)
    }
    img.src = capturedImage
  }

  const confirmCapture = () => {
    if (cropMode) {
      applyCrop()
    } else if (capturedImage) {
      onCapture(capturedImage)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-indigo-dark">纹样拍摄</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-h-[500px] mx-auto">
            {!capturedImage ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full relative cursor-move"
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
              >
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
                {cropMode && (
                  <>
                    <div
                      className="absolute border-2 border-white border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                      style={{
                        left: cropArea.x,
                        top: cropArea.y,
                        width: cropArea.width,
                        height: cropArea.height,
                      }}
                    >
                      <div className="absolute -top-1 -left-1 w-6 h-6 bg-white rounded-full" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full" />
                    </div>
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                      拖拽选择裁剪区域
                    </p>
                  </>
                )}
              </div>
            )}

            {!isReady && !capturedImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="animate-spin text-white text-4xl">⏳</div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center justify-center gap-4 mt-6">
            {!capturedImage ? (
              <>
                <button
                  onClick={switchCamera}
                  className="p-4 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  title="切换相机"
                >
                  <RotateCw size={24} className="text-gray-700" />
                </button>
                <button
                  onClick={captureImage}
                  disabled={!isReady}
                  className="p-6 bg-red-vermilion hover:bg-red-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera size={32} className="text-white" />
                </button>
                <button
                  onClick={onClose}
                  className="p-4 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  title="取消"
                >
                  <VideoOff size={24} className="text-gray-700" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={retake}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-2"
                >
                  <RotateCw size={20} className="text-gray-700" />
                  重新拍摄
                </button>
                <button
                  onClick={() => setCropMode(!cropMode)}
                  className={`px-6 py-3 rounded-xl transition-colors flex items-center gap-2 ${
                    cropMode
                      ? 'bg-gold-earth text-white hover:bg-amber-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Crop size={20} />
                  裁剪
                </button>
                <button
                  onClick={confirmCapture}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors flex items-center gap-2"
                >
                  <Check size={20} />
                  确认使用
                </button>
              </>
            )}
          </div>

          {cropMode && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="text-sm text-gray-600">裁剪框大小:</div>
              <button
                onClick={() => setCropArea((prev) => ({ ...prev, width: Math.min(500, prev.width + 20), height: Math.min(500, prev.height + 20) }))}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                +
              </button>
              <span>{cropArea.width} x {cropArea.height}</span>
              <button
                onClick={() => setCropArea((prev) => ({ ...prev, width: Math.max(100, prev.width - 20), height: Math.max(100, prev.height - 20) }))}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                -
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CameraCapture
