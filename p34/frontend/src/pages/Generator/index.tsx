import React, { useState } from 'react'
import {
  Play,
  Download,
  RotateCw,
  Maximize2,
  RefreshCw,
  ChevronDown,
  Image,
  Plus,
  X,
} from 'lucide-react'

const Generator: React.FC = () => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [parameters, setParameters] = useState({
    scale: 100,
    rotation: 0,
    density: 50,
    repeatX: 3,
    repeatY: 3,
  })
  const [selectedColors, setSelectedColors] = useState(['#C41E3A', '#B8860B', '#1E3A5F'])
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('https://picsum.photos/600/600?random=100')

  const availableFeatures = [
    { id: '1', name: '苗族云纹', thumbnail: 'https://picsum.photos/80/80?random=20' },
    { id: '2', name: '彝族几何纹', thumbnail: 'https://picsum.photos/80/80?random=21' },
    { id: '3', name: '壮族水纹', thumbnail: 'https://picsum.photos/80/80?random=22' },
    { id: '4', name: '傣族花卉纹', thumbnail: 'https://picsum.photos/80/80?random=23' },
    { id: '5', name: '藏族吉祥纹', thumbnail: 'https://picsum.photos/80/80?random=24' },
  ]

  const colorPalette = [
    '#C41E3A', '#B8860B', '#1E3A5F', '#2E7D32', '#7B1FA2',
    '#E65100', '#424242', '#F5F0E6', '#FFFFFF', '#000000',
  ]

  const generatedPatterns = [
    { id: '1', thumbnail: 'https://picsum.photos/120/120?random=30', createdAt: '2024-01-15' },
    { id: '2', thumbnail: 'https://picsum.photos/120/120?random=31', createdAt: '2024-01-14' },
    { id: '3', thumbnail: 'https://picsum.photos/120/120?random=32', createdAt: '2024-01-13' },
    { id: '4', thumbnail: 'https://picsum.photos/120/120?random=33', createdAt: '2024-01-12' },
  ]

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    )
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setPreviewUrl(`https://picsum.photos/600/600?random=${Date.now()}`)
    setIsGenerating(false)
  }

  return (
    <div className="h-screen flex flex-col bg-paper-white">
      <div className="bg-white border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-indigo-dark">图案生成器</h1>
            <p className="text-gray-500 text-sm mt-1">组合纹样特征，生成全新传统图案</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={selectedFeatures.length === 0 || isGenerating}
              className="btn-primary flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Play size={20} />
              )}
              {isGenerating ? '生成中...' : '生成图案'}
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Download size={20} />
              导出
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-white border-r overflow-y-auto p-6">
          <div className="mb-8">
            <h3 className="font-medium text-indigo-dark mb-4 flex items-center gap-2">
              <Image size={18} />
              选择纹样特征
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              已选择 {selectedFeatures.length} / {availableFeatures.length} 个特征
            </p>
            <div className="grid grid-cols-2 gap-3">
              {availableFeatures.map((feature) => (
                <button
                  key={feature.id}
                  onClick={() => toggleFeature(feature.id)}
                  className={`relative p-2 rounded-lg border-2 transition-all ${
                    selectedFeatures.includes(feature.id)
                      ? 'border-red-vermilion bg-red-vermilion/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={feature.thumbnail}
                    alt={feature.name}
                    className="w-full aspect-square rounded object-cover"
                  />
                  <p className="text-xs text-gray-700 mt-2 truncate">{feature.name}</p>
                  {selectedFeatures.includes(feature.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-red-vermilion rounded-full flex items-center justify-center">
                      <X size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-medium text-indigo-dark mb-4">颜色方案</h3>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedColors.includes(color)
                      ? 'border-red-vermilion ring-2 ring-red-vermilion/30'
                      : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              {selectedColors.map((color) => (
                <div
                  key={color}
                  className="flex-1 h-8 rounded-lg"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-medium text-indigo-dark mb-4">参数调整</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-600">缩放比例</label>
                  <span className="text-sm font-medium text-indigo-dark">{parameters.scale}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={parameters.scale}
                  onChange={(e) => setParameters({ ...parameters, scale: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-600">旋转角度</label>
                  <span className="text-sm font-medium text-indigo-dark">{parameters.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={parameters.rotation}
                  onChange={(e) => setParameters({ ...parameters, rotation: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-600">排列密度</label>
                  <span className="text-sm font-medium text-indigo-dark">{parameters.density}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={parameters.density}
                  onChange={(e) => setParameters({ ...parameters, density: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 mb-2 block">横向重复</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={parameters.repeatX}
                    onChange={(e) => setParameters({ ...parameters, repeatX: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-2 block">纵向重复</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={parameters.repeatY}
                    onChange={(e) => setParameters({ ...parameters, repeatY: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <button className="w-full btn-outline flex items-center justify-center gap-2">
              <Plus size={18} />
              保存为预设
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-100">
            <div className="relative">
              <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="预览图案"
                  className="w-[500px] h-[500px] object-cover"
                />
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <button className="p-2 bg-white/90 rounded-lg shadow hover:bg-white transition-colors">
                  <RotateCw size={20} className="text-gray-600" />
                </button>
                <button className="p-2 bg-white/90 rounded-lg shadow hover:bg-white transition-colors">
                  <Maximize2 size={20} className="text-gray-600" />
                </button>
              </div>
              {isGenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white">
                    <RefreshCw size={40} className="mx-auto mb-3 animate-spin" />
                    <p className="font-medium">正在生成图案...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-t p-6">
            <h3 className="font-medium text-indigo-dark mb-4">历史生成</h3>
            <div className="flex gap-4">
              {generatedPatterns.map((pattern) => (
                <button
                  key={pattern.id}
                  className="group relative rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-dark transition-all"
                >
                  <img
                    src={pattern.thumbnail}
                    alt="生成的图案"
                    className="w-24 h-24 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 size={20} className="text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Generator
