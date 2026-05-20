import { Wind, Leaf, AlertTriangle } from 'lucide-react';
import { Card } from './shared/Card';
import { useFormulaStore } from '../store/useFormulaStore';
import { CalculationResult } from '../types';

export function SmokeEstimator() {
  const { calculationResult } = useFormulaStore();

  const getEcoScoreColor = (score: CalculationResult['ecoScore']) => {
    const colors: Record<CalculationResult['ecoScore'], string> = {
      A: 'from-green-400 to-emerald-500',
      B: 'from-lime-400 to-green-500',
      C: 'from-yellow-400 to-amber-500',
      D: 'from-orange-400 to-red-500',
      E: 'from-red-500 to-rose-600',
    };
    return colors[score];
  };

  const getEcoScoreBg = (score: CalculationResult['ecoScore']) => {
    const colors: Record<CalculationResult['ecoScore'], string> = {
      A: 'bg-green-100 text-green-700',
      B: 'bg-lime-100 text-lime-700',
      C: 'bg-yellow-100 text-yellow-700',
      D: 'bg-orange-100 text-orange-700',
      E: 'bg-red-100 text-red-700',
    };
    return colors[score];
  };

  const getEcoDescription = (score: CalculationResult['ecoScore']) => {
    const descriptions: Record<CalculationResult['ecoScore'], string> = {
      A: '极低碳排放，非常环保',
      B: '低碳排放，环保性能良好',
      C: '中等碳排放，环保性能一般',
      D: '较高碳排放，建议优化配方',
      E: '高碳排放，强烈建议优化配方',
    };
    return descriptions[score];
  };

  return (
    <Card title="烟气估算" icon={<Wind size={24} />}>
      <div className="space-y-6">
        {calculationResult ? (
          <>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br ${getEcoScoreColor(
                    calculationResult.ecoScore
                  )} shadow-lg`}
                >
                  <span className="text-3xl font-bold text-white">
                    {calculationResult.ecoScore}
                  </span>
                </div>
                <div className="mt-3 text-sm text-gray-500">环保等级</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">
                  {calculationResult.smokeEmission}
                </div>
                <div className="mt-1 text-sm text-gray-500">烟气排放指数</div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl text-center ${getEcoScoreBg(
                calculationResult.ecoScore
              )}`}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {calculationResult.ecoScore <= 'B' ? (
                  <Leaf size={20} />
                ) : (
                  <AlertTriangle size={20} />
                )}
                <span className="font-medium">{getEcoDescription(calculationResult.ecoScore)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-600">环保等级标尺</div>
              <div className="h-4 rounded-full overflow-hidden flex">
                <div className="flex-1 bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                  A
                </div>
                <div className="flex-1 bg-gradient-to-r from-emerald-400 to-lime-400 flex items-center justify-center text-xs font-bold text-white">
                  B
                </div>
                <div className="flex-1 bg-gradient-to-r from-lime-400 to-yellow-400 flex items-center justify-center text-xs font-bold text-white">
                  C
                </div>
                <div className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center text-xs font-bold text-white">
                  D
                </div>
                <div className="flex-1 bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center text-xs font-bold text-white">
                  E
                </div>
              </div>
              <div className="relative">
                <div
                  className="absolute -top-1 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-700 transform -translate-x-1/2"
                  style={{
                    left: `${Math.min(Math.max(calculationResult.smokeEmission * 100, 10), 90)}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="text-sm text-green-600 mb-1">环保建议</div>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• 增加大豆蜡或蜂蜡比例</li>
                  <li>• 减少石蜡含量</li>
                  <li>• 使用纯棉蜡芯</li>
                </ul>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="text-sm text-amber-600 mb-1">注意事项</div>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• 保持通风良好</li>
                  <li>• 避免长时间燃烧</li>
                  <li>• 定期修剪蜡芯</li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Wind size={48} className="mx-auto mb-3 opacity-50" />
            <p>添加蜡料后自动计算烟气排放</p>
          </div>
        )}
      </div>
    </Card>
  );
}
