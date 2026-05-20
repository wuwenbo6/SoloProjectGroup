import { useState, useCallback } from 'react'

interface ImageUploaderProps {
  onUpload: (file: File) => void
}

function ImageUploader({ onUpload }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleFile(files[0])
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    onUpload(file)
  }, [onUpload])

  return (
    <div className="bg-white rounded-xl p-8 card-shadow">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
        上传显微图像进行分析
      </h2>
      
      <div
        className={`upload-area rounded-xl p-12 text-center cursor-pointer ${
          isDragging ? 'dragover' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {preview ? (
          <div>
            <img
              src={preview}
              alt="预览"
              className="max-h-64 mx-auto rounded-lg shadow-md mb-4"
            />
            <p className="text-gray-600">点击或拖拽更换图片</p>
          </div>
        ) : (
          <div>
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-600 mb-2">拖拽图像到此处，或点击上传</p>
            <p className="text-sm text-gray-400">支持 JPG、PNG、BMP 等格式</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">🔬</div>
          <p className="text-sm text-gray-600 mt-2">纤维分割</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">📊</div>
          <p className="text-sm text-gray-600 mt-2">老化分级</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">⚠️</div>
          <p className="text-sm text-gray-600 mt-2">破损预测</p>
        </div>
      </div>
    </div>
  )
}

export default ImageUploader
