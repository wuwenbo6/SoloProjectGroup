import React from 'react';
import { WaveformViewer } from '../components/WaveformViewer';
import { RecordingControls } from '../components/RecordingControls';
import { ProcessingPanel } from '../components/ProcessingPanel';

export const Processor: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">音频处理器</h1>
        <div className="text-gray-400 text-sm">
          录制黑胶唱片音频并进行专业处理
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecordingControls />
          <WaveformViewer />
        </div>
        
        <div>
          <ProcessingPanel />
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-medium mb-4">使用说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="text-gray-300">
            <div className="text-yellow-400 font-medium mb-1">1. 爆音切除</div>
            <p>检测并修复黑胶唱片常见的爆音和划痕噪音，通过插值算法平滑修复受损样本。</p>
          </div>
          <div className="text-gray-300">
            <div className="text-green-400 font-medium mb-1">2. 降噪处理</div>
            <p>采用频谱减法算法，有效去除背景噪音、嘶嘶声和静电干扰，保留音频细节。</p>
          </div>
          <div className="text-gray-300">
            <div className="text-blue-400 font-medium mb-1">3. 转速校正</div>
            <p>自动检测音频基频，校正唱盘转速偏差，支持变速不变调的相位声码器算法。</p>
          </div>
          <div className="text-gray-300">
            <div className="text-purple-400 font-medium mb-1">4. 导出保存</div>
            <p>支持 WAV 格式导出，16/24/32 位深度，可保存到曲目库方便后续管理。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
