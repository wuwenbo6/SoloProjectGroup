import { useState, useCallback } from 'react'
import axios from 'axios'
import ImageUploader from './components/ImageUploader'
import AnalysisResults from './components/AnalysisResults'
import BatchAnalysis from './components/BatchAnalysis'
import { AnalysisData } from './types'

interface BatchError {
  filename: string
  error: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single')
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [batchResults, setBatchResults] = useState<AnalysisData[]>([])
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([])
  const [batchStats, setBatchStats] = useState<{ total: number; success: number; failed: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSingleUpload = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      if (response.data.success) {
        setAnalysisData({
          ...response.data.data,
          filename: file.name,
        })
      }
    } catch (err) {
      setError('分析失败，请重试')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleBatchUpload = useCallback(async (files: File[]) => {
    setIsLoading(true)
    setError(null)
    setBatchErrors([])
    
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await axios.post('/api/batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      if (response.data.success) {
        setBatchResults(response.data.data)
        setBatchErrors(response.data.errors || [])
        setBatchStats({
          total: response.data.total_files || files.length,
          success: response.data.count || 0,
          failed: response.data.error_count || 0
        })
      }
    } catch (err) {
      setError('批量分析失败，请重试')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleReset = useCallback(() => {
    setAnalysisData(null)
    setBatchResults([])
    setBatchErrors([])
    setBatchStats(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="gradient-bg text-white py-6 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">显微图像分析系统</h1>
          <p className="text-white/80">纤维分割 · 老化等级判断 · 破损预测 · 批量推理</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => { setActiveTab('single'); handleReset(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'single'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            单张分析
          </button>
          <button
            onClick={() => { setActiveTab('batch'); handleReset(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'batch'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            批量分析
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-spinner mb-4"></div>
            <p className="text-gray-600">正在分析图像，请稍候...</p>
          </div>
        )}

        {!isLoading && activeTab === 'single' && (
          <div>
            {!analysisData ? (
              <ImageUploader onUpload={handleSingleUpload} />
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    分析结果: {analysisData.filename}
                  </h2>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    重新上传
                  </button>
                </div>
                <AnalysisResults data={analysisData} />
              </div>
            )}
          </div>
        )}

        {!isLoading && activeTab === 'batch' && (
          <div>
            {batchResults.length === 0 && batchErrors.length === 0 ? (
              <BatchAnalysis onUpload={handleBatchUpload} />
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    批量分析结果
                  </h2>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    重新上传
                  </button>
                </div>
                
                {batchStats && (
                  <div className="bg-white rounded-xl p-4 mb-6 card-shadow">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{batchStats.total}</p>
                        <p className="text-sm text-gray-500">总文件数</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{batchStats.success}</p>
                        <p className="text-sm text-gray-500">成功处理</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{batchStats.failed}</p>
                        <p className="text-sm text-gray-500">处理失败</p>
                      </div>
                    </div>
                  </div>
                )}

                {batchErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <h3 className="font-medium text-red-800 mb-3">处理失败的文件</h3>
                    <ul className="space-y-2">
                      {batchErrors.map((err, index) => (
                        <li key={index} className="text-sm text-red-700">
                          <span className="font-medium">{err.filename}:</span> {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {batchResults.length > 0 && (
                  <div className="space-y-6">
                    {batchResults.map((result, index) => (
                      <div key={index} className="bg-white rounded-xl p-6 card-shadow">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
                          图像 {index + 1}: {result.filename}
                        </h3>
                        <AnalysisResults data={result} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-400">
          <p>显微图像分析系统 v1.0.0</p>
          <p className="text-sm mt-2">基于计算机视觉和机器学习技术</p>
        </div>
      </footer>
    </div>
  )
}

export default App
