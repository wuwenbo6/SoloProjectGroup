import { useEffect, useState } from 'react';
import { QualityPrediction, ParameterRecommendation } from '../../shared/types';
import { useMonitorStore } from '../store/monitorStore';
import { Sparkles, Lightbulb, TrendingUp, Thermometer, Droplets, Wind, Clock, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';

const qualityLevelConfig = {
  excellent: { label: '特级', color: '#10b981', description: '品质卓越，香气浓郁' },
  good: { label: '优质', color: '#3b82f6', description: '品质良好，口感纯正' },
  normal: { label: '标准', color: '#f59e0b', description: '品质正常，符合标准' },
  poor: { label: '待改进', color: '#ef4444', description: '品质偏差，需调整参数' },
};

const priorityConfig = {
  high: { label: '高', color: '#ef4444', bgColor: 'bg-red-500/10' },
  medium: { label: '中', color: '#f59e0b', bgColor: 'bg-amber-500/10' },
  low: { label: '低', color: '#10b981', bgColor: 'bg-emerald-500/10' },
};

export const Intelligence = () => {
  const [loading, setLoading] = useState(true);
  const { qualityPrediction, parameterRecommendations, setQualityPrediction, setParameterRecommendations } = useMonitorStore();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [predictionRes, recommendationsRes] = await Promise.all([
        fetch('http://localhost:3001/api/ai/quality-prediction'),
        fetch('http://localhost:3001/api/ai/parameter-recommendations'),
      ]);

      const predictionData = await predictionRes.json();
      const recommendationsData = await recommendationsRes.json();

      setQualityPrediction(predictionData);
      setParameterRecommendations(recommendationsData);
    } catch (error) {
      console.error('Failed to fetch AI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const factorChartData = qualityPrediction
    ? [
        { name: '温度', value: qualityPrediction.factors.temperature, fill: '#10b981' },
        { name: '湿度', value: qualityPrediction.factors.humidity, fill: '#3b82f6' },
        { name: '氧浓度', value: qualityPrediction.factors.oxygen, fill: '#f59e0b' },
        { name: '发酵时间', value: qualityPrediction.factors.fermentationTime, fill: '#8b5cf6' },
      ]
    : [];

  const radialData = qualityPrediction
    ? [
        { name: '品质评分', value: qualityPrediction.score, fill: qualityLevelConfig[qualityPrediction.level].color },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-blue-400 animate-pulse" />
          <p className="text-slate-400">AI 分析中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">智能分析中心</h1>
          </div>
          <p className="text-slate-400">基于实时工艺参数的 AI 品质预测与优化建议</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 品质预测卡片 */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">制茶品质预测</h2>
                <p className="text-sm text-slate-400">基于当前工艺参数的品质评估</p>
              </div>
            </div>

            {qualityPrediction && (
              <div className="space-y-6">
                {/* 评分环形图 */}
                <div className="flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={radialData}>
                        <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#1e293b' }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-white">{qualityPrediction.score}</span>
                      <span className="text-sm text-slate-400">综合评分</span>
                    </div>
                  </div>
                </div>

                {/* 品质等级 */}
                <div
                  className="p-4 rounded-xl text-center"
                  style={{ backgroundColor: qualityLevelConfig[qualityPrediction.level].color + '20' }}
                >
                  <div
                    className="text-2xl font-bold mb-1"
                    style={{ color: qualityLevelConfig[qualityPrediction.level].color }}
                  >
                    {qualityLevelConfig[qualityPrediction.level].label}
                  </div>
                  <p className="text-sm text-slate-300">
                    {qualityLevelConfig[qualityPrediction.level].description}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    预测置信度：{qualityPrediction.confidence.toFixed(1)}%
                  </p>
                </div>

                {/* 因子得分图表 */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={factorChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)} 分`, '得分']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 改进建议 */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    优化建议
                  </h3>
                  {qualityPrediction.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 参数推荐卡片 */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
                <Lightbulb className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">智能参数推荐</h2>
                <p className="text-sm text-slate-400">基于发酵阶段的动态参数调整</p>
              </div>
            </div>

            <div className="space-y-4">
              {parameterRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${priorityConfig[rec.priority].bgColor} border-slate-700/50`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        rec.priority === 'high'
                          ? 'bg-red-500/20 text-red-400'
                          : rec.priority === 'medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      优先级：{priorityConfig[rec.priority].label}
                    </span>
                  </div>

                  <p className="text-slate-200 text-sm mb-4">{rec.rationale}</p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg">
                      <Thermometer className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs text-slate-500">目标温度</p>
                        <p className="text-sm font-medium text-white">{rec.targetTemperature}℃</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-xs text-slate-500">目标湿度</p>
                        <p className="text-sm font-medium text-white">{rec.targetHumidity}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg">
                      <Wind className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="text-xs text-slate-500">目标氧浓度</p>
                        <p className="text-sm font-medium text-white">{rec.targetOxygen}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
