import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  Leaf, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  ArrowUp, 
  ArrowDown,
  Zap,
  Truck,
  Factory,
  Sun,
  Building2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { ReductionSuggestion, BenchmarkComparison } from '../types';

const categoryIcons: Record<string, any> = {
  '能源优化': Zap,
  '运输优化': Truck,
  '供应链优化': Factory,
  '办公管理': Building2,
  '生产优化': Factory,
  '可再生能源': Sun,
};

export function Reduction() {
  const { user } = useAuthStore();
  const [suggestions, setSuggestions] = useState<ReductionSuggestion[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadReductionData();
    }
  }, [user]);

  const loadReductionData = async () => {
    try {
      setLoading(true);
      const [suggestionData, benchmarkData] = await Promise.all([
        api.getReductionSuggestions(user!.company_id),
        api.getBenchmark(user!.company_id, user!.industry || '电子信息'),
      ]);
      setSuggestions(suggestionData);
      setBenchmarks(benchmarkData.comparisons || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...new Set(suggestions.map(s => s.category))];

  const filteredSuggestions = selectedCategory === 'all'
    ? suggestions
    : suggestions.filter(s => s.category === selectedCategory);

  const totalPotentialReduction = suggestions.reduce((sum, s) => sum + s.estimated_reduction_amount, 0);

  const benchmarkChartOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['企业排放', '行业平均', '行业前25%'], top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: benchmarks.map(b => b.metric?.substring(0, 6) || '') },
    yAxis: { type: 'value', name: 'tCO2e' },
    series: [
      { name: '企业排放', type: 'bar', data: benchmarks.map(b => b.company_value), itemStyle: { color: '#1B4D3E' } },
      { name: '行业平均', type: 'bar', data: benchmarks.map(b => b.industry_average), itemStyle: { color: '#9CA3AF' } },
      { name: '行业前25%', type: 'bar', data: benchmarks.map(b => b.industry_top25), itemStyle: { color: '#3CB371' } },
    ],
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-50 text-red-600 border-red-200',
    medium: 'bg-amber-50 text-amber-600 border-amber-200',
    low: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  const priorityLabels: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">减排建议</h1>
        <p className="text-gray-500 mt-1">基于行业基准的智能减排方案推荐</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">预计总减排潜力</p>
              <p className="text-3xl font-bold mt-2">{(totalPotentialReduction / 1000).toFixed(1)}</p>
              <p className="text-emerald-100 text-xs mt-1">千吨 CO2e</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">高优先级措施</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">
                {suggestions.filter(s => s.priority === 'high').length}
              </p>
              <p className="text-gray-400 text-xs mt-1">项</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">低成本措施</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">
                {suggestions.filter(s => s.cost_level === '低').length}
              </p>
              <p className="text-gray-400 text-xs mt-1">项</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">快速回收</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">
                {suggestions.filter(s => s.payback_period?.includes('6') || s.payback_period?.includes('1年')).length}
              </p>
              <p className="text-gray-400 text-xs mt-1">项</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">行业基准对比</h3>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-gray-500">所属行业:</span>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
            {user?.industry || '电子信息'}
          </span>
        </div>
        <ReactECharts option={benchmarkChartOption} style={{ height: '300px' }} />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-800">减排措施推荐</h3>
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSuggestions.map((suggestion, idx) => {
            const IconComponent = categoryIcons[suggestion.category] || Leaf;
            return (
              <div
                key={suggestion.id}
                className="p-5 rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    suggestion.priority === 'high' ? 'bg-red-100' : 
                    suggestion.priority === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'
                  }`}>
                    <IconComponent className={`w-6 h-6 ${
                      suggestion.priority === 'high' ? 'text-red-500' : 
                      suggestion.priority === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-gray-800">{suggestion.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[suggestion.priority]}`}>
                        {priorityLabels[suggestion.priority]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{suggestion.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Leaf className="w-3 h-3 text-emerald-500" />
                        减排 {suggestion.estimated_reduction_pct}%
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-amber-500" />
                        成本 {suggestion.cost_level}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {suggestion.payback_period}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">预计减排量</span>
                        <span className="font-medium text-emerald-600">
                          {suggestion.estimated_reduction_amount.toFixed(2)} tCO2e
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(suggestion.estimated_reduction_pct * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
