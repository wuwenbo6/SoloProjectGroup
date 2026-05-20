import { useState } from 'react';
import { AlertTriangle, Search, ChevronRight, Wrench, Lightbulb, Activity } from 'lucide-react';
import { RootCauseAnalysis as RootCauseAnalysisType } from '../../shared/types';
import { useMonitorStore } from '../store/monitorStore';

const severityConfig = {
  critical: { label: '严重', color: '#ef4444', bgColor: 'bg-red-500/10' },
  high: { label: '高', color: '#f59e0b', bgColor: 'bg-amber-500/10' },
  medium: { label: '中', color: '#3b82f6', bgColor: 'bg-blue-500/10' },
};

const anomalyTypes = [
  { id: 'temperature_high', label: '温度过高', icon: '🌡️' },
  { id: 'humidity_high', label: '湿度过高', icon: '💧' },
  { id: 'oxygen_low', label: '氧浓度过低', icon: '🌀' },
];

export const RootCauseAnalysisPage = () => {
  const [selectedAnomaly, setSelectedAnomaly] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { rootCauseAnalysis, setRootCauseAnalysis } = useMonitorStore();

  const handleAnalyze = async () => {
    if (!selectedAnomaly) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/root-cause-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyType: selectedAnomaly }),
      });
      const data = await response.json();
      setRootCauseAnalysis(data);
    } catch (error) {
      console.error('Failed to analyze root cause:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white">异常根因分析</h1>
          </div>
          <p className="text-slate-400">AI 驱动的异常诊断与智能解决方案推荐</p>
        </div>

        {/* 异常选择区域 */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            选择异常类型
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {anomalyTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedAnomaly(type.id)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedAnomaly === type.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl mb-2 block">{type.icon}</span>
                <span className="text-white font-medium">{type.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!selectedAnomaly || loading}
            className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Activity className="w-5 h-5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                开始分析
              </>
            )}
          </button>
        </div>

        {/* 分析结果区域 */}
        {rootCauseAnalysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 根因分析 */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-amber-500/20 to-red-500/20 rounded-xl">
                  <Lightbulb className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">诊断结果</h2>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${severityConfig[rootCauseAnalysis.severity].bgColor}`}
                    style={{ color: severityConfig[rootCauseAnalysis.severity].color }}
                  >
                    {severityConfig[rootCauseAnalysis.severity].label}级别异常
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {/* 主要原因 */}
                <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                  <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    主要原因
                  </h3>
                  <p className="text-white">{rootCauseAnalysis.primaryCause}</p>
                </div>

                {/* 影响因素 */}
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">其他影响因素</h3>
                  <div className="space-y-2">
                    {rootCauseAnalysis.contributingFactors.map((factor, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 text-sm">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 解决方案 */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl">
                  <Wrench className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">解决方案</h2>
                  <p className="text-sm text-slate-400">AI 推荐的处理步骤</p>
                </div>
              </div>

              <div className="space-y-4">
                {rootCauseAnalysis.suggestedActions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-white">{action}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-emerald-400 text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  建议在 30 分钟内完成以上操作，以避免影响产品品质
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!rootCauseAnalysis && !loading && (
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-12 border border-slate-700/50 text-center">
            <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">暂无分析结果</h3>
            <p className="text-slate-500">请选择异常类型并点击开始分析</p>
          </div>
        )}
      </div>
    </div>
  );
};
