import { useState } from 'react';
import { X, Star, Play } from 'lucide-react';
import { levels, getLevelById } from '@/levels/levels';
import { useGameStore } from '@/store/useGameStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LevelSelector({ isOpen, onClose }: Props) {
  const { setCurrentLevel, updateAllObjects, resetGame, setTargetWaterLevel, setWaterLevel } = useGameStore();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const handleSelectLevel = (levelId: number) => {
    setSelectedLevel(levelId);
  };

  const handleStartLevel = () => {
    if (selectedLevel === null) return;
    
    const level = getLevelById(selectedLevel);
    if (!level) return;
    
    resetGame();
    setCurrentLevel(selectedLevel);
    
    const objectsWithNewIds = level.initialObjects.map((obj) => ({
      ...obj,
      id: `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
    
    updateAllObjects(objectsWithNewIds);
    setWaterLevel(200);
    setTargetWaterLevel(200);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">选择关卡</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {levels.map((level) => (
            <div
              key={level.id}
              onClick={() => handleSelectLevel(level.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                selectedLevel === level.id
                  ? 'bg-blue-600 ring-2 ring-blue-400'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-semibold">{level.name}</h3>
                <div className="flex gap-1">
                  {level.stars.map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className="text-yellow-400 fill-yellow-400/30"
                    />
                  ))}
                </div>
              </div>
              
              <p className="text-slate-300 text-sm mb-3">{level.description}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>目标: {level.targetRPM} RPM</span>
                <span>时限: {level.timeLimit > 0 ? `${level.timeLimit}秒` : '无限制'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleStartLevel}
            disabled={selectedLevel === null}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            <Play size={20} />
            开始关卡
          </button>
        </div>
      </div>
    </div>
  );
}
