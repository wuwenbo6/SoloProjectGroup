import React, { useState, useRef, useEffect, useCallback } from 'react'
import { fabric } from 'fabric'
import {
  Brush,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Palette,
  Sliders,
  Layers,
  Search,
  Settings,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Grid,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const Editor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const { user } = useAuthStore()

  const [tool, setTool] = useState('brush')
  const [brushSize, setBrushSize] = useState(8)
  const [brushColor, setBrushColor] = useState('#000000')
  const [zoom, setZoom] = useState(100)
  const [history, setHistory] = useState<any[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSidebar, setShowSidebar] = useState(true)
  const [selectedLayer, setSelectedLayer] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [showColorPanel, setShowColorPanel] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showExportPanel, setShowExportPanel] = useState(false)
  const [showSimilarityPanel, setShowSimilarityPanel] = useState(false)

  const [colorParams, setColorParams] = useState({
    hue: 0,
    saturation: 0,
    brightness: 0,
    contrast: 0,
  })

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [styleIntensity, setStyleIntensity] = useState(50)
  const [exportFormat, setExportFormat] = useState('png')
  const [exportQuality, setExportQuality] = useState(95)
  const [similarityResults, setSimilarityResults] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const layers = [
    { id: 0, name: '背景层', visible: true, opacity: 100 },
    { id: 1, name: '纹样层', visible: true, opacity: 100 },
    { id: 2, name: '细节层', visible: true, opacity: 80 },
    { id: 3, name: '装饰层', visible: false, opacity: 60 },
  ]

  const styleFilters = [
    { id: 'traditional', name: '传统纹样', description: '古典民族风格' },
    { id: 'modern', name: '现代简约', description: '简洁现代风格' },
    { id: 'ink', name: '水墨效果', description: '中国水墨风格' },
    { id: 'gold', name: '鎏金效果', description: '金色华丽风格' },
    { id: 'woodblock', name: '版画效果', description: '木刻版画风格' },
    { id: 'embroidery', name: '刺绣效果', description: '丝线刺绣风格' },
    { id: 'batik', name: '蜡染效果', description: '民族蜡染风格' },
  ]

  const presetColors = [
    '#000000', '#8B4513', '#D4AF37', '#654321', '#800000',
    '#FFFFFF', '#2F4F4F', '#CD853F', '#8B0000', '#2E8B57',
    '#4682B4', '#9932CC', '#FF6347', '#FFD700', '#32CD32',
  ]

  useEffect(() => {
    if (canvasRef.current && !fabricRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#f8f5f0',
        preserveObjectStacking: true,
      })

      fabricRef.current = canvas
      saveToHistory()

      canvas.on('path:created', () => {
        saveToHistory()
      })
    }

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
      }
    }
  }, [])

  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return
    const json = fabricRef.current.toJSON()
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(json)
      return newHistory.slice(-50)
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = () => {
    if (historyIndex > 0 && fabricRef.current) {
      const newIndex = historyIndex - 1
      fabricRef.current.loadFromJSON(history[newIndex], () => {
        fabricRef.current?.renderAll()
      })
      setHistoryIndex(newIndex)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1 && fabricRef.current) {
      const newIndex = historyIndex + 1
      fabricRef.current.loadFromJSON(history[newIndex], () => {
        fabricRef.current?.renderAll()
      })
      setHistoryIndex(newIndex)
    }
  }

  useEffect(() => {
    if (!fabricRef.current) return

    if (tool === 'brush') {
      fabricRef.current.isDrawingMode = true
      fabricRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricRef.current)
      fabricRef.current.freeDrawingBrush.width = brushSize
      fabricRef.current.freeDrawingBrush.color = brushColor
    } else if (tool === 'eraser') {
      fabricRef.current.isDrawingMode = true
      fabricRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricRef.current)
      fabricRef.current.freeDrawingBrush.width = brushSize * 2
      fabricRef.current.freeDrawingBrush.color = '#f8f5f0'
    } else if (tool === 'select') {
      fabricRef.current.isDrawingMode = false
    }
  }, [tool, brushSize, brushColor])

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(25, Math.min(200, zoom + delta))
    setZoom(newZoom)
    if (fabricRef.current) {
      fabricRef.current.setZoom(newZoom / 100)
    }
  }

  const clearCanvas = () => {
    if (fabricRef.current && window.confirm('确定要清空画布吗？')) {
      fabricRef.current.clear()
      fabricRef.current.backgroundColor = '#f8f5f0'
      saveToHistory()
    }
  }

  const exportCanvas = () => {
    if (!fabricRef.current) return
    
    const dataURL = fabricRef.current.toDataURL({
      format: exportFormat,
      quality: exportQuality / 100,
      multiplier: 2,
    })
    
    const link = document.createElement('a')
    link.download = `纹样_${Date.now()}.${exportFormat}`
    link.href = dataURL
    link.click()
  }

  const applyColorAdjustment = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      saveToHistory()
    } finally {
      setIsProcessing(false)
    }
  }

  const applyStyleFilter = async (filterId: string) => {
    setIsProcessing(true)
    setSelectedStyle(filterId)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      saveToHistory()
    } finally {
      setIsProcessing(false)
    }
  }

  const searchSimilarPatterns = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSimilarityResults([
        { id: '1', name: '苗族蜡染纹样 A', similarity: 0.92, thumbnail: 'https://picsum.photos/100/100?random=101' },
        { id: '2', name: '侗族刺绣纹样 B', similarity: 0.87, thumbnail: 'https://picsum.photos/100/100?random=102' },
        { id: '3', name: '彝族漆器纹样 C', similarity: 0.78, thumbnail: 'https://picsum.photos/100/100?random=103' },
        { id: '4', name: '壮族织锦纹样 D', similarity: 0.71, thumbnail: 'https://picsum.photos/100/100?random=104' },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  const tools = [
    { id: 'select', icon: Settings, name: '选择' },
    { id: 'brush', icon: Brush, name: '画笔' },
    { id: 'eraser', icon: Eraser, name: '橡皮擦' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-16 bg-indigo-dark text-white flex flex-col items-center py-4 gap-2">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`p-3 rounded-lg transition-all ${
              tool === t.id
                ? 'bg-indigo-600 shadow-lg'
                : 'hover:bg-white/10'
            }`}
            title={t.name}
          >
            <t.icon size={20} />
          </button>
        ))}

        <div className="h-px bg-white/20 my-2 w-10" />

        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          className="p-3 rounded-lg hover:bg-white/10 disabled:opacity-40"
          title="撤销"
        >
          <Undo2 size={20} />
        </button>
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="p-3 rounded-lg hover:bg-white/10 disabled:opacity-40"
          title="重做"
        >
          <Redo2 size={20} />
        </button>

        <div className="h-px bg-white/20 my-2 w-10" />

        <button
          onClick={() => handleZoom(10)}
          className="p-3 rounded-lg hover:bg-white/10"
          title="放大"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={() => handleZoom(-10)}
          className="p-3 rounded-lg hover:bg-white/10"
          title="缩小"
        >
          <ZoomOut size={20} />
        </button>
        <span className="text-xs text-white/70">{zoom}%</span>

        <div className="flex-1" />

        <button
          onClick={() => setShowHelp(true)}
          className="p-3 rounded-lg hover:bg-white/10"
          title="帮助"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
          <Link to="/materials" className="text-gray-500 hover:text-gray-700">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="font-semibold text-gray-800">纹样编辑器</h1>

          <div className="flex-1" />

          {tool === 'brush' && (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-gray-500">{brushSize}px</span>
            </div>
          )}

          <button
            onClick={clearCanvas}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="清空"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={saveToHistory}
            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
            title="保存"
          >
            <Save size={20} />
          </button>
          <button
            onClick={() => setShowExportPanel(!showExportPanel)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Download size={18} />
            导出
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-8">
          <div
            className="bg-white shadow-xl rounded-lg overflow-hidden"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
          >
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="h-10 bg-white border-t border-gray-200 flex items-center px-4 gap-4 text-sm text-gray-500">
          <span>画布: 800 × 600</span>
          <span className="text-gray-300">|</span>
          <span>工具: {tools.find(t => t.id === tool)?.name}</span>
          <span className="text-gray-300">|</span>
          <span>缩放: {zoom}%</span>
          <div className="flex-1" />
          <span className="text-green-600">● 实时协作已连接</span>
        </div>
      </div>

      <div
        className={`w-80 bg-white border-l border-gray-200 flex flex-col transition-all ${
          showSidebar ? '' : 'w-0 overflow-hidden'
        }`}
      >
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-20 -left-3 z-10 p-1 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50"
        >
          {showSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setShowColorPanel(true)
              setShowStylePanel(false)
              setShowExportPanel(false)
              setShowSimilarityPanel(false)
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              showColorPanel ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
            }`}
          >
            <Palette size={16} className="inline mr-1" />
            色彩
          </button>
          <button
            onClick={() => {
              setShowColorPanel(false)
              setShowStylePanel(true)
              setShowExportPanel(false)
              setShowSimilarityPanel(false)
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              showStylePanel ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
            }`}
          >
            <Sparkles size={16} className="inline mr-1" />
            风格
          </button>
          <button
            onClick={() => {
              setShowColorPanel(false)
              setShowStylePanel(false)
              setShowExportPanel(true)
              setShowSimilarityPanel(false)
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              showExportPanel ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
            }`}
          >
            <Download size={16} className="inline mr-1" />
            导出
          </button>
          <button
            onClick={() => {
              setShowColorPanel(false)
              setShowStylePanel(false)
              setShowExportPanel(false)
              setShowSimilarityPanel(true)
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              showSimilarityPanel ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
            }`}
          >
            <Search size={16} className="inline mr-1" />
            相似
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showColorPanel && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3">预设颜色</h3>
                <div className="grid grid-cols-5 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setBrushColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        brushColor === color ? 'border-indigo-600 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3">色彩调整</h3>
                <div className="space-y-4">
                  {[
                    { key: 'hue', label: '色相', min: -180, max: 180 },
                    { key: 'saturation', label: '饱和度', min: -100, max: 100 },
                    { key: 'brightness', label: '亮度', min: -100, max: 100 },
                    { key: 'contrast', label: '对比度', min: -100, max: 100 },
                  ].map((item) => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="text-gray-400">{colorParams[item.key as keyof typeof colorParams]}</span>
                      </div>
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        value={colorParams[item.key as keyof typeof colorParams]}
                        onChange={(e) =>
                          setColorParams((prev) => ({
                            ...prev,
                            [item.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={applyColorAdjustment}
                  disabled={isProcessing}
                  className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing && <RotateCw size={16} className="animate-spin" />}
                  应用调整
                </button>
              </div>
            </div>
          )}

          {showStylePanel && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">效果强度</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={styleIntensity}
                  onChange={(e) => setStyleIntensity(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-right text-sm text-gray-400">{styleIntensity}%</div>
              </div>

              <div className="space-y-2">
                {styleFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => applyStyleFilter(filter.id)}
                    disabled={isProcessing}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedStyle === filter.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    <div className="font-medium text-gray-800">{filter.name}</div>
                    <div className="text-sm text-gray-500">{filter.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showExportPanel && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">导出格式</label>
                  <div className="flex gap-2">
                    {['png', 'jpg', 'svg'].map((format) => (
                      <button
                        key={format}
                        onClick={() => setExportFormat(format)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                          exportFormat === format
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    导出质量: {exportQuality}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={exportQuality}
                    onChange={(e) => setExportQuality(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <button
                onClick={exportCanvas}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                导出当前纹样
              </button>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-800 mb-3">批量导出</h4>
                <p className="text-sm text-gray-500 mb-3">
                  可选择多个纹样项目，批量导出为ZIP压缩包
                </p>
                <button
                  className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  打开批量导出工具
                </button>
              </div>
            </div>
          )}

          {showSimilarityPanel && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                基于颜色、纹理、形状特征，在素材库中检索相似的传统纹样
              </p>

              <button
                onClick={searchSimilarPatterns}
                disabled={isProcessing}
                className="w-full py-3 bg-gold-earth text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : (
                  <Search size={18} />
                )}
                搜索相似纹样
              </button>

              {similarityResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-800">
                    找到 {similarityResults.length} 个相似纹样
                  </h4>
                  {similarityResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer"
                    >
                      <img
                        src={result.thumbnail}
                        alt={result.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 text-sm">{result.name}</div>
                        <div className="text-xs text-gray-500">
                          相似度: {Math.round(result.similarity * 100)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gold-earth">
                          {Math.round(result.similarity * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showColorPanel && !showStylePanel && !showExportPanel && !showSimilarityPanel && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Layers size={18} />
                  图层管理
                </h3>
                <div className="space-y-1">
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center gap-2 ${
                        selectedLayer === layer.id
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: `hsl(${layer.id * 60}, 70%, 50%)` }}
                      />
                      <span className="flex-1 text-sm">{layer.name}</span>
                      <button className="p-1 hover:bg-gray-200 rounded">
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Sliders size={18} />
                  图层属性
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>不透明度</span>
                      <span>{layers[selectedLayer]?.opacity || 100}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layers[selectedLayer]?.opacity || 100}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Share2 size={18} />
                  协作设置
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" defaultChecked className="rounded" />
                    允许协作者编辑
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded" />
                    显示协作者光标
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" defaultChecked className="rounded" />
                    自动同步变更
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">编辑器使用指南</h2>
            <div className="space-y-4 text-gray-600">
              <div>
                <h3 className="font-medium text-gray-800">基本操作</h3>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>选择画笔工具后，可在画布上自由绘制纹样轮廓</li>
                  <li>使用橡皮擦工具擦除不需要的部分</li>
                  <li>按 Ctrl+Z 撤销，Ctrl+Y 重做操作</li>
                  <li>使用滚轮或按钮缩放画布</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800">色彩调整</h3>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>调整色相改变整体色彩倾向</li>
                  <li>饱和度调节色彩的鲜艳程度</li>
                  <li>亮度调整画面明暗</li>
                  <li>对比度调整画面反差</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800">风格滤镜</h3>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>选择预设的民族风格滤镜</li>
                  <li>调节效果强度控制应用程度</li>
                  <li>支持传统、水墨、鎏金等多种风格</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800">相似检索</h3>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>基于AI的纹样相似度检索</li>
                  <li>在素材库中找到相近的传统纹样</li>
                  <li>可按民族和分类筛选结果</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 flex items-center gap-4 shadow-xl">
            <RotateCw size={24} className="animate-spin text-indigo-600" />
            <span className="text-gray-800">处理中，请稍候...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Editor
