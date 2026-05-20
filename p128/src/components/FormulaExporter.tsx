import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Save, Trash2 } from 'lucide-react';
import { Card } from './shared/Card';
import { useFormulaStore } from '../store/useFormulaStore';
import { exportFormula } from '../utils/export';

export function FormulaExporter() {
  const { formulaName, setFormulaName, formulas, saveFormula, deleteFormula, calculationResult } = useFormulaStore();
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const canSave = calculationResult !== null;

  const handleExport = (formula: typeof formulas[0]) => {
    exportFormula(formula, exportFormat);
  };

  return (
    <Card title="配方导出" icon={<Download size={24} />}>
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">配方名称</label>
            <input
              type="text"
              value={formulaName}
              onChange={(e) => setFormulaName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              placeholder="输入配方名称"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={saveFormula}
              disabled={!canSave}
              className={`flex-1 px-6 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium ${
                canSave
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              保存配方
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">导出格式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('json')}
                className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-medium ${
                  exportFormat === 'json'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileJson size={18} />
                JSON
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-medium ${
                  exportFormat === 'csv'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileSpreadsheet size={18} />
                CSV
              </button>
            </div>
          </div>
        </div>

        {formulas.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-600">已保存配方 ({formulas.length})</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {formulas.map((formula) => (
                <div
                  key={formula.id}
                  className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{formula.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formula.waxes.length}种蜡料 · {formula.totalWeight}g · {formula.burnTime}小时 · 等级{formula.smokeEmission <= 0.25 ? 'A' : formula.smokeEmission <= 0.35 ? 'B' : formula.smokeEmission <= 0.5 ? 'C' : formula.smokeEmission <= 0.65 ? 'D' : 'E'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formula.createdAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport(formula)}
                        className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                        title="导出"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => deleteFormula(formula.id)}
                        className="p-2 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Save size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">保存配方后可在此处管理</p>
          </div>
        )}
      </div>
    </Card>
  );
}
