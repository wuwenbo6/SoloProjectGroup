import { useState, useEffect } from 'react';
import { Droplets, Plus, Trash2 } from 'lucide-react';
import { Card } from './shared/Card';
import { useFormulaStore } from '../store/useFormulaStore';
import { WaxType, WAX_TYPE_INFO } from '../types';
import { calculateTotalWeight } from '../utils/calculations';
import { generateId } from '../utils/calculations';

const waxTypes = Object.entries(WAX_TYPE_INFO) as [WaxType, { name: string; burnCoefficient: number; smokeFactor: number }][];

export function WaxRatioCalculator() {
  const { currentWaxes, addWax, updateWax, removeWax, calculate } = useFormulaStore();
  const [selectedType, setSelectedType] = useState<WaxType>('soy');
  const [newWeight, setNewWeight] = useState(100);

  const totalWeight = calculateTotalWeight(currentWaxes);

  useEffect(() => {
    calculate();
  }, [currentWaxes, calculate]);

  const handleAddWax = () => {
    if (newWeight <= 0) return;
    const newWax = {
      id: generateId(),
      name: WAX_TYPE_INFO[selectedType].name,
      weight: newWeight,
      percentage: 0,
      meltPoint: 50,
      type: selectedType,
    };
    addWax(newWax);
  };

  const getWaxColor = (type: WaxType) => {
    const colors: Record<WaxType, string> = {
      soy: 'bg-green-100 border-green-300 text-green-700',
      paraffin: 'bg-gray-100 border-gray-300 text-gray-700',
      beeswax: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      palm: 'bg-orange-100 border-orange-300 text-orange-700',
      gel: 'bg-blue-100 border-blue-300 text-blue-700',
      coconut: 'bg-cyan-100 border-cyan-300 text-cyan-700',
    };
    return colors[type];
  };

  return (
    <Card title="蜡料配比" icon={<Droplets size={24} />}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">蜡料类型</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as WaxType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            >
              {waxTypes.map(([type, info]) => (
                <option key={type} value={type}>
                  {info.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-600 mb-1">重量(g)</label>
            <input
              type="number"
              value={newWeight || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setNewWeight(Math.max(0, value));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              min="0"
            />
          </div>
          <button
            onClick={handleAddWax}
            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            添加
          </button>
        </div>

        {currentWaxes.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>已添加蜡料</span>
              <span className="font-semibold text-amber-600">总重: {totalWeight}g</span>
            </div>
            
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
              {currentWaxes.map((wax) => (
                <div
                  key={wax.id}
                  className={`h-full transition-all duration-500 ${getWaxColor(wax.type).split(' ')[0]}`}
                  style={{ width: `${wax.percentage}%` }}
                  title={`${wax.name}: ${wax.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentWaxes.map((wax) => (
                <div
                  key={wax.id}
                  className={`p-4 rounded-xl border-2 transition-all ${getWaxColor(wax.type)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{wax.name}</div>
                      <div className="text-sm opacity-75">
                        {wax.percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24">
                        <input
                          type="number"
                          value={wax.weight || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateWax(wax.id, { weight: Math.max(0, value) });
                          }}
                          className="w-full px-3 py-1 bg-white/50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          min="0"
                        />
                      </div>
                      <span className="text-sm font-medium w-12">g</span>
                      <button
                        onClick={() => removeWax(wax.id)}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentWaxes.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Droplets size={48} className="mx-auto mb-3 opacity-50" />
            <p>请添加蜡料开始配比</p>
          </div>
        )}
      </div>
    </Card>
  );
}
