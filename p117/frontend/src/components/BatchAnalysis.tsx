import { useState, useCallback } from 'react'

interface BatchAnalysisProps {
  onUpload: (files: File[]) => void
}

function BatchAnalysis({ onUpload }: BatchAnalysisProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

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
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleStartAnalysis = useCallback(() => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles)
    }
  }, [selectedFiles, onUpload])

  return (
    <div className="bg-white rounded-xl p-8 card-shadow">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
        批量上传显微图像进行分析
      </h2>
      
      <div
        className={`upload-area rounded-xl p-8 text-center cursor-pointer ${
          isDragging ? 'dragover' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('batchFileInput')?.click()}
      >
        <input
          id="batchFileInput"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <p className="text-gray-600 mb-1">拖拽多张图像到此处，或点击上传</p>
        <p className="text-sm text-gray-400">支持批量上传和处理</p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium text-gray-700 mb-3">
            已选择 {selectedFiles.length} 张图像
          </h3>
          <div className="max-h-48 overflow-y-auto border rounded-lg">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400">📷</span>
                  <span className="text-sm text-gray-700 truncate max-w-xs">
                    {file.name}
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex space-x-4">
            <button
              onClick={() => setSelectedFiles([])}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              清空列表
            </button>
            <button
              onClick={handleStartAnalysis}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg"
            >
              开始批量分析
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">💡 批量分析说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 支持同时上传多张显微图像</li>
          <li>• 系统将自动处理每张图像并生成分析报告</li>
          <li>• 分析结果包含纤维分割、老化等级和破损预测</li>
          <li>• 建议单次上传不超过10张图像以保证处理速度</li>
        </ul>
      </div>
    </div>
  )
}

export default BatchAnalysis
