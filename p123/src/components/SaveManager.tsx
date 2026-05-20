import { useState, useEffect } from 'react';
import { X, Save, Download, Trash2 } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getSaves, saveGame, loadSave, deleteSave, formatTimestamp } from '@/utils/saveUtils';
import { SaveData } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SaveManager({ isOpen, onClose }: Props) {
  const { objects, waterLevel, currentLevelId, score, updateAllObjects, setTargetWaterLevel, setCurrentLevel, setWaterLevel } = useGameStore();
  const [saves, setSaves] = useState<SaveData[]>([]);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    if (isOpen) {
      refreshSaves();
    }
  }, [isOpen]);

  const refreshSaves = () => {
    setSaves(getSaves());
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    
    saveGame(saveName.trim(), objects, waterLevel, currentLevelId, score);
    setSaveName('');
    refreshSaves();
  };

  const handleLoad = (saveData: SaveData) => {
    const loadedObjects = saveData.objects.map((obj, index) => ({
      ...obj,
      id: obj.id || `${obj.type}-${Date.now()}-${index}`,
    }));
    
    updateAllObjects(loadedObjects);
    setTargetWaterLevel(saveData.waterLevel.targetHeight);
    setWaterLevel(saveData.waterLevel.height);
    setCurrentLevel(saveData.levelId || null);
    useGameStore.setState({ score: saveData.score });
    onClose();
  };

  const handleDelete = (saveId: string) => {
    deleteSave(saveId);
    refreshSaves();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">存档管理</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3">保存当前状态</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="输入存档名称..."
              className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save size={18} />
              保存
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">已有存档</h3>
          {saves.length === 0 ? (
            <p className="text-slate-400 text-center py-8">暂无存档</p>
          ) : (
            <div className="space-y-2">
              {saves.map((save) => (
                <div
                  key={save.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                >
                  <div>
                    <div className="text-white font-medium">{save.name}</div>
                    <div className="text-slate-400 text-xs">
                      {formatTimestamp(save.timestamp)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoad(save)}
                      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      title="加载"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(save.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
