import React from 'react';
import { Zap, Volume2, Gauge, Play, Download } from 'lucide-react';
import { useAudioStore } from '../store/useAudioStore';

export const ProcessingPanel: React.FC = () => {
  const { processingParams, setProcessingParams, applyAllProcessing, isProcessing, processingProgress, exportAudio } = useAudioStore();

  const handleExport = async () => {
    await exportAudio('processed_audio', { format: 'wav', bitDepth: 16, sampleRate: 44100, quality: 100 });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-medium mb-4">音频处理</h3>

      <div className="space-y-6">
        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">爆音切除</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={processingParams.clickRemoval.enabled}
                onChange={(e) => setProcessingParams({
                  clickRemoval: { ...processingParams.clickRemoval, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-gray-300 text-sm">阈值: {processingParams.clickRemoval.threshold}</label>
              <input
                type="range"
                min="10"
                max="90"
                value={processingParams.clickRemoval.threshold}
                onChange={(e) => setProcessingParams({
                  clickRemoval: { ...processingParams.clickRemoval, threshold: parseInt(e.target.value) }
                })}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm">灵敏度: {processingParams.clickRemoval.sensitivity}</label>
              <input
                type="range"
                min="30"
                max="100"
                value={processingParams.clickRemoval.sensitivity}
                onChange={(e) => setProcessingParams({
                  clickRemoval: { ...processingParams.clickRemoval, sensitivity: parseInt(e.target.value) }
                })}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">降噪处理</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={processingParams.noiseReduction.enabled}
                onChange={(e) => setProcessingParams({
                  noiseReduction: { ...processingParams.noiseReduction, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
          
          <div>
            <label className="text-gray-300 text-sm">强度: {processingParams.noiseReduction.strength}</label>
            <input
              type="range"
              min="10"
              max="90"
              value={processingParams.noiseReduction.strength}
              onChange={(e) => setProcessingParams({
                noiseReduction: { ...processingParams.noiseReduction, strength: parseInt(e.target.value) }
              })}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">转速校正</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={processingParams.speedCorrection.enabled}
                onChange={(e) => setProcessingParams({
                  speedCorrection: { ...processingParams.speedCorrection, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-gray-300 text-sm">目标速度: {processingParams.speedCorrection.targetSpeed}%</label>
              <input
                type="range"
                min="80"
                max="120"
                value={processingParams.speedCorrection.targetSpeed}
                onChange={(e) => setProcessingParams({
                  speedCorrection: { ...processingParams.speedCorrection, targetSpeed: parseInt(e.target.value) }
                })}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="preservePitch"
                checked={processingParams.speedCorrection.preservePitch}
                onChange={(e) => setProcessingParams({
                  speedCorrection: { ...processingParams.speedCorrection, preservePitch: e.target.checked }
                })}
                className="w-4 h-4 text-blue-500 bg-gray-600 rounded border-gray-500 focus:ring-blue-500"
              />
              <label htmlFor="preservePitch" className="text-gray-300 text-sm">保持音高</label>
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={applyAllProcessing}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white py-3 rounded-lg transition-colors"
          >
            <Play className="w-5 h-5" />
            {isProcessing ? '处理中...' : '应用处理'}
          </button>
          
          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            导出音频
          </button>
        </div>
      </div>
    </div>
  );
};
