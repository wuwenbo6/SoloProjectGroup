import { useState } from 'react';
import { Layers, Plus, Trash2, Play, Download } from 'lucide-react';
import { Card } from './shared/Card';
import { useFormulaStore } from '../store/useFormulaStore';
import { BatchFormula, WAX_TYPE_INFO, WICK_TYPES, CONTAINER_TYPES } from '../types';
import { generateId } from '../utils/calculations';
import { exportBatchFormulas } from '../utils/export';

export function BatchCalculator() {
  const { batchFormulas, addBatchFormula, removeBatchFormula, calculateBatch } = useFormulaStore();
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const addNewFormula = () => {
    const defaultWick = WICK_TYPES[0];
    const defaultContainer = CONTAINER_TYPES[0];
    const newFormula: BatchFormula = {
      id: generateId(),
      name: `配方 ${batchFormulas.length + 1}`,
      waxes: [
        {
          id: generateId(),
          name: WAX_TYPE_INFO.soy.name,
          weight: 200,
          percentage: 100,
          meltPoint: 50,
          type: 'soy',
        },
      ],
      wick: {
        id: generateId(),
        type: defaultWick.type,
        size: defaultWick.size,
        burnRate: defaultWick.burnRate,
      },
      container: {
        id: generateId(),
        name: defaultContainer.name,
        diameter: defaultContainer.diameter,
        height: defaultContainer.height,
        volume: defaultContainer.volume,
      },
    };
    addBatchFormula(newFormula);
  };

  const handleCalculateAll = () => {
    calculateBatch();
  };

  const handleExportAll = () => {
    const formulasToExport = batchFormulas
      .filter((f) => f.result)
      .map((f) => ({
        id: f.id,
        name: f.name,
        waxes: f.waxes || [],
        wick: f.wick || { id: '', type: '', size: '', burnRate: 1 },
        container: f.container || { id: '', name: '', diameter: 0, height: 0, volume: 0 },
        totalWeight: (f.waxes || []).reduce((sum, w) => sum + (w.weight || 0), 0),
        burnTime: f.result?.burnTime || 0,
        smokeEmission: f.result?.smokeEmission || 0,
        createdAt: new Date().toLocaleString('zh-CN'),
      }));
    exportBatchFormulas(formulasToExport, exportFormat);
  };

  const getEcoScoreColor = (score: string) => {
    const colors: Record<string, string> = {
      A: 'bg-green-500',
      B: 'bg-lime-500',
      C: 'bg-yellow-500',
      D: 'bg-orange-500',
      E: 'bg-red-500',
    };
    return colors[score] || 'bg-gray-400';
  };

  return (
    <Card title="批量计算" icon={<Layers size={24} />}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={addNewFormula}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-md hover:shadow-lg font-medium"
          >
            <Plus size={18} />
            添加配方
          </button>
          <button
            onClick={handleCalculateAll}
            disabled={batchFormulas.length === 0}
            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
              batchFormulas.length > 0
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-md hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play size={18} />
            全部计算
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              onClick={handleExportAll}
              disabled={batchFormulas.filter((f) => f.result).length === 0}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                batchFormulas.filter((f) => f.result).length > 0
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download size={16} />
              导出结果
            </button>
          </div>
        </div>

        {batchFormulas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">配方名称</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">蜡料组成</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">总重</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">蜡芯</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">容器</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">燃烧时间</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">环保等级</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {batchFormulas.map((formula) => (
                  <tr key={formula.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{formula.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(formula.waxes || []).map((wax) => (
                          <span
                            key={wax.id}
                            className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                          >
                            {wax.name || '-'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(formula.waxes || []).reduce((sum, w) => sum + (w.weight || 0), 0)}g
                    </td>
                    <td className="py-3 px-4 text-center">{formula.wick?.size || '-'}</td>
                    <td className="py-3 px-4 text-center">{formula.container?.name || '-'}</td>
                    <td className="py-3 px-4 text-center font-medium text-amber-600">
                      {formula.result ? `${formula.result.burnTime}h` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {formula.result ? (
                        <span
                          className={`inline-block w-8 h-8 rounded-full ${getEcoScoreColor(
                            formula.result.ecoScore
                          )} text-white font-bold text-sm flex items-center justify-center`}
                        >
                          {formula.result.ecoScore}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => removeBatchFormula(formula.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Layers size={48} className="mx-auto mb-3 opacity-50" />
            <p>点击"添加配方"开始批量计算</p>
          </div>
        )}

        {batchFormulas.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-amber-600">{batchFormulas.length}</div>
                <div className="text-sm text-gray-500">配方总数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {batchFormulas.filter((f) => f.result).length}
                </div>
                <div className="text-sm text-gray-500">已计算</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {
                    batchFormulas
                      .filter((f) => f.result)
                      .reduce((sum, f) => sum + (f.result?.burnTime || 0), 0)
                      .toFixed(1)
                  }
                  h
                </div>
                <div className="text-sm text-gray-500">总燃烧时间</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
