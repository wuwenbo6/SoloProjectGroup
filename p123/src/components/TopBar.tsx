import { useState } from 'react';
import { Flag, Save, RotateCcw, Play, Pause, Share2, Download, Copy, Check } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { LevelSelector } from './LevelSelector';
import { SaveManager } from './SaveManager';
import { getLevelById } from '@/levels/levels';

export function TopBar() {
  const {
    currentLevelId,
    isPlaying,
    setPlaying,
    elapsedTime,
    objects,
    resetGame,
    totalPowerOutput,
    getExportData,
    importObjects,
  } = useGameStore();
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [showSaveManager, setShowSaveManager] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  const currentLevel = currentLevelId ? getLevelById(currentLevelId) : null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getMaxRPM = (): number => {
    let maxRPM = 0;
    objects.forEach((obj) => {
      if (obj.type === 'waterwheel' || obj.type === 'gear') {
        const velocity = (obj as unknown as { angularVelocity: number }).angularVelocity;
        const rpm = Math.abs((velocity * 60) / (2 * Math.PI));
        maxRPM = Math.max(maxRPM, rpm);
      }
    });
    return maxRPM;
  };

  const handleCopyShare = () => {
    const data = getExportData();
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const data = getExportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-wheel-sim-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      if (data.objects && Array.isArray(data.objects)) {
        importObjects(data.objects);
        setShowImport(false);
        setImportJson('');
      }
    } catch (e) {
      alert('导入失败：无效的JSON格式');
    }
  };

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-slate-800/95 backdrop-blur-sm px-5 py-3 rounded-xl shadow-xl border border-slate-700">
        <button
          onClick={() => setShowLevelSelector(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <Flag size={18} />
          <span className="text-sm font-medium">{currentLevel ? currentLevel.name : '选择关卡'}</span>
        </button>

        <div className="h-8 w-px bg-slate-600" />

        <button
          onClick={() => setPlaying(!isPlaying)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isPlaying
              ? 'bg-orange-600 hover:bg-orange-500 text-white'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span className="text-sm font-medium">{isPlaying ? '暂停' : '开始'}</span>
        </button>

        <button
          onClick={resetGame}
          className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          <RotateCcw size={18} />
          <span className="text-sm font-medium">重置</span>
        </button>

        <button
          onClick={() => setShowSaveManager(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Save size={18} />
          <span className="text-sm font-medium">存档</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
          >
            <Share2 size={18} />
            <span className="text-sm font-medium">分享</span>
          </button>

          {showShareMenu && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-3 z-50">
              <h4 className="text-white font-medium mb-3 text-sm">导出/导入作品</h4>
              
              <div className="space-y-2">
                <button
                  onClick={handleCopyShare}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {copied ? '已复制!' : '复制到剪贴板'}
                </button>
                
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  <Download size={16} />
                  下载JSON文件
                </button>
                
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600/50 hover:bg-blue-500/50 text-white rounded-lg transition-colors text-sm"
                >
                  <Share2 size={16} />
                  导入作品
                </button>
              </div>

              {showImport && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder="粘贴JSON数据..."
                    className="w-full h-24 bg-slate-700 text-white text-xs p-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleImport}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
                    >
                      确认导入
                    </button>
                    <button
                      onClick={() => setShowImport(false)}
                      className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-600" />

        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-slate-400 text-xs">用时</div>
            <div className="text-white font-mono font-bold text-lg">{formatTime(elapsedTime)}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">最高 RPM</div>
            <div className="text-cyan-400 font-mono font-bold text-lg">{getMaxRPM().toFixed(0)}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">输出功率</div>
            <div className="text-yellow-400 font-mono font-bold text-lg">{Math.round(totalPowerOutput)} W</div>
          </div>
          {currentLevel && currentLevel.targetRPM > 0 && (
            <div className="text-center">
              <div className="text-slate-400 text-xs">目标</div>
              <div className="text-green-400 font-mono font-bold text-lg">{currentLevel.targetRPM} RPM</div>
            </div>
          )}
        </div>
      </div>

      <LevelSelector isOpen={showLevelSelector} onClose={() => setShowLevelSelector(false)} />
      <SaveManager isOpen={showSaveManager} onClose={() => setShowSaveManager(false)} />
    </>
  );
}
