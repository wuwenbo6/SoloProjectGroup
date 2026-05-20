import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { WaterWheel, Gear, LoadObject, MATERIALS, MaterialType } from '@/types';
import { getRPM } from '@/physics/WaterFlow';

export function PropertyPanel() {
  const { objects, selectedObjectId, updateObject, removeObject, setObjectMaterial, repairObject, connectLoadToGear } = useGameStore();
  const [connectingLoad, setConnectingLoad] = useState(false);
  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  if (!selectedObject) {
    return (
      <div className="absolute right-4 top-20 z-10 w-72 bg-slate-800/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-700">
        <h3 className="text-white font-semibold mb-2">属性</h3>
        <p className="text-slate-400 text-sm">选择一个物体查看属性</p>
      </div>
    );
  }

  const handleConnectToGear = (gearId: string) => {
    if (selectedObject.type === 'load') {
      connectLoadToGear(selectedObjectId, gearId);
      setConnectingLoad(false);
    }
  };

  const availableGears = objects.filter((o) => o.type === 'gear' && o.id !== selectedObjectId);

  return (
    <div className="absolute right-4 top-20 z-10 w-72 bg-slate-800/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-700 max-h-[calc(100vh-100px)] overflow-y-auto">
      <h3 className="text-white font-semibold mb-3">属性</h3>

      <div className="space-y-4">
        <div>
          <label className="text-slate-400 text-xs block mb-1">类型</label>
          <div className="text-white text-sm font-medium">
            {selectedObject.type === 'waterwheel' ? '水车' :
             selectedObject.type === 'gear' ? '齿轮' :
             selectedObject.type === 'load' ? '负载' : selectedObject.type}
          </div>
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-1">材料</label>
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(MATERIALS).map(([key, material]) => (
              <button
                key={key}
                onClick={() => setObjectMaterial(selectedObjectId, key as MaterialType)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  selectedObject.material === key
                    ? 'border-blue-400 bg-blue-500/20'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
                title={material.name}
              >
                <div
                  className="w-6 h-6 rounded-full mx-auto"
                  style={{ backgroundColor: material.color }}
                />
                <div className="text-xs text-slate-300 mt-1 truncate">{material.name}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedObject.durability !== undefined && selectedObject.maxDurability && (
          <div>
            <label className="text-slate-400 text-xs block mb-1">
              耐久度: {Math.round(selectedObject.durability)} / {selectedObject.maxDurability}
            </label>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${(selectedObject.durability / selectedObject.maxDurability) * 100}%`,
                  backgroundColor: selectedObject.durability / selectedObject.maxDurability > 0.5
                    ? '#4ade80'
                    : selectedObject.durability / selectedObject.maxDurability > 0.25
                    ? '#fbbf24'
                    : '#ef4444',
                }}
              />
            </div>
            <button
              onClick={() => repairObject(selectedObjectId)}
              className="mt-2 w-full py-1 px-3 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
            >
              🔧 修复
            </button>
          </div>
        )}

        <div>
          <label className="text-slate-400 text-xs block mb-1">位置 X</label>
          <input
            type="number"
            value={Math.round(selectedObject.x)}
            onChange={(e) => updateObject(selectedObjectId, { x: Number(e.target.value) })}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-1">位置 Y</label>
          <input
            type="number"
            value={Math.round(selectedObject.y)}
            onChange={(e) => updateObject(selectedObjectId, { y: Number(e.target.value) })}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {selectedObject.type === 'waterwheel' && (
          <>
            <div>
              <label className="text-slate-400 text-xs block mb-1">
                半径: {(selectedObject as WaterWheel).radius} px
              </label>
              <input
                type="range"
                min="50"
                max="120"
                value={(selectedObject as WaterWheel).radius}
                onChange={(e) => updateObject(selectedObjectId, { radius: Number(e.target.value) } as Partial<WaterWheel>)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">
                叶片数量: {(selectedObject as WaterWheel).bladeCount}
              </label>
              <input
                type="range"
                min="4"
                max="16"
                step="2"
                value={(selectedObject as WaterWheel).bladeCount}
                onChange={(e) => updateObject(selectedObjectId, { bladeCount: Number(e.target.value) } as Partial<WaterWheel>)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">转速 (RPM)</label>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {getRPM(selectedObject as WaterWheel).toFixed(1)}
              </div>
            </div>
          </>
        )}

        {selectedObject.type === 'gear' && (
          <>
            <div>
              <label className="text-slate-400 text-xs block mb-1">
                半径: {(selectedObject as Gear).radius} px
              </label>
              <input
                type="range"
                min="40"
                max="100"
                value={(selectedObject as Gear).radius}
                onChange={(e) => updateObject(selectedObjectId, { radius: Number(e.target.value) } as Partial<Gear>)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">
                齿数: {(selectedObject as Gear).teeth}
              </label>
              <input
                type="range"
                min="12"
                max="36"
                step="2"
                value={(selectedObject as Gear).teeth}
                onChange={(e) => updateObject(selectedObjectId, { teeth: Number(e.target.value) } as Partial<Gear>)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">转速 (RPM)</label>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {Math.abs(((selectedObject as Gear).angularVelocity * 60) / (2 * Math.PI)).toFixed(1)}
              </div>
            </div>
          </>
        )}

        {selectedObject.type === 'load' && (
          <>
            <div>
              <label className="text-slate-400 text-xs block mb-1">负载类型</label>
              <div className="text-white text-sm font-medium">
                {{
                  generator: '⚡ 发电机',
                  millstone: '🌾 磨盘',
                  pump: '💧 水泵',
                  conveyor: '⚙️ 传送带',
                }[(selectedObject as LoadObject).loadType] || '未知'}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">输出功率</label>
              <div className="text-2xl font-bold text-yellow-400 font-mono">
                {Math.round((selectedObject as LoadObject).output || 0)} W
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">状态</label>
              <div className={`text-sm font-medium ${(selectedObject as LoadObject).isRunning ? 'text-green-400' : 'text-slate-500'}`}>
                {(selectedObject as LoadObject).isRunning ? '🟢 运行中' : '⚪ 已停止'}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">连接到齿轮</label>
              {availableGears.length === 0 ? (
                <p className="text-slate-500 text-sm">没有可用的齿轮</p>
              ) : connectingLoad ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableGears.map((gear) => (
                    <button
                      key={gear.id}
                      onClick={() => handleConnectToGear(gear.id)}
                      className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors text-left"
                    >
                      齿轮 ({Math.round(gear.x)}, {Math.round(gear.y)})
                    </button>
                  ))}
                  <button
                    onClick={() => setConnectingLoad(false)}
                    className="w-full py-2 px-3 bg-red-600/30 hover:bg-red-600/50 text-red-400 text-sm rounded-lg transition-colors"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {(selectedObject as LoadObject).connectedTo ? (
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 text-sm">已连接到齿轮</span>
                      <button
                        onClick={() => connectLoadToGear(selectedObjectId, null)}
                        className="text-red-400 text-xs hover:text-red-300"
                      >
                        断开
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConnectingLoad(true)}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                    >
                      🔗 连接到齿轮
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="pt-2 border-t border-slate-700">
          <button
            onClick={() => removeObject(selectedObjectId)}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>🗑️</span> 删除物体
          </button>
        </div>
      </div>
    </div>
  );
}
