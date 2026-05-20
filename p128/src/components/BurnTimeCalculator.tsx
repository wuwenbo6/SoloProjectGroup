import { useEffect } from 'react';
import { Clock, Flame } from 'lucide-react';
import { Card } from './shared/Card';
import { useFormulaStore } from '../store/useFormulaStore';
import { WICK_TYPES, CONTAINER_TYPES } from '../types';
import { generateId } from '../utils/calculations';

export function BurnTimeCalculator() {
  const { currentWick, currentContainer, setWick, setContainer, calculate, calculationResult } = useFormulaStore();

  useEffect(() => {
    calculate();
  }, [currentWick, currentContainer, calculate]);

  const handleWickChange = (size: string) => {
    const wickInfo = WICK_TYPES.find((w) => w.size === size);
    if (wickInfo) {
      setWick({
        id: generateId(),
        type: wickInfo.type,
        size: wickInfo.size,
        burnRate: wickInfo.burnRate,
      });
    }
  };

  const handleContainerChange = (name: string) => {
    const containerInfo = CONTAINER_TYPES.find((c) => c.name === name);
    if (containerInfo) {
      setContainer({
        id: generateId(),
        name: containerInfo.name,
        diameter: containerInfo.diameter,
        height: containerInfo.height,
        volume: containerInfo.volume,
      });
    }
  };

  return (
    <Card title="燃烧时间计算" icon={<Clock size={24} />}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">蜡芯类型</label>
            <select
              value={currentWick.size}
              onChange={(e) => handleWickChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            >
              {WICK_TYPES.map((wick) => (
                <option key={wick.size} value={wick.size}>
                  {wick.size} - 燃烧速率: {wick.burnRate}x
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">容器类型</label>
            <select
              value={currentContainer.name}
              onChange={(e) => handleContainerChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            >
              {CONTAINER_TYPES.map((container) => (
                <option key={container.name} value={container.name}>
                  {container.name} - {container.volume}ml (ø{container.diameter}cm)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">蜡芯类型</div>
            <div className="text-lg font-bold text-gray-800">{currentWick.type}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">燃烧速率</div>
            <div className="text-lg font-bold text-gray-800">{currentWick.burnRate}x</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">容器直径</div>
            <div className="text-lg font-bold text-gray-800">{currentContainer.diameter}cm</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">容器容积</div>
            <div className="text-lg font-bold text-gray-800">{currentContainer.volume}ml</div>
          </div>
        </div>

        {calculationResult && (
          <div className="flex items-center justify-center gap-6 p-6 bg-gradient-to-r from-amber-100 via-orange-100 to-yellow-100 rounded-2xl">
            <div className="p-4 bg-white rounded-full shadow-lg">
              <Flame className="w-12 h-12 text-orange-500" />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">预计燃烧时间</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {calculationResult.burnTime}
              </div>
              <div className="text-lg font-medium text-gray-600">小时</div>
            </div>
          </div>
        )}

        {!calculationResult && (
          <div className="text-center py-6 text-gray-400">
            <Clock size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">添加蜡料后自动计算</p>
          </div>
        )}
      </div>
    </Card>
  );
}
