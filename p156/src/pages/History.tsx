import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Calendar, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { EmissionTrend } from '../types';

export function History() {
  const { user } = useAuthStore();
  const [trendData, setTrendData] = useState<EmissionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('12');

  useEffect(() => {
    if (user) {
      loadTrendData();
    }
  }, [user, selectedPeriod]);

  const loadTrendData = async () => {
    try {
      setLoading(true);
      const data = await api.getEmissionTrend(user!.company_id, parseInt(selectedPeriod));
      setTrendData(data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const trendLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['范围一', '范围二', '范围三', '总量'], top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trendData.map(d => d.period) },
    yAxis: [
      { type: 'value', name: 'tCO2e', position: 'left' },
    ],
    series: [
      { name: '范围一', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope1), color: '#1B4D3E' },
      { name: '范围二', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope2), color: '#2E8B57' },
      { name: '范围三', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope3), color: '#3CB371' },
      { name: '总量', type: 'line', data: trendData.map(d => d.total), color: '#E67E22', lineStyle: { width: 3, type: 'dashed' } },
    ],
  };

  const comparisonBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['本期', '上期'], top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['范围一', '范围二', '范围三'] },
    yAxis: { type: 'value', name: 'tCO2e' },
    series: [
      { 
        name: '本期', 
        type: 'bar', 
        data: trendData.length > 0 ? [
          trendData[trendData.length - 1].scope1,
          trendData[trendData.length - 1].scope2,
          trendData[trendData.length - 1].scope3
        ] : [],
        itemStyle: { color: '#1B4D3E' }
      },
      { 
        name: '上期', 
        type: 'bar', 
        data: trendData.length > 1 ? [
          trendData[trendData.length - 2].scope1,
          trendData[trendData.length - 2].scope2,
          trendData[trendData.length - 2].scope3
        ] : [],
        itemStyle: { color: '#9CA3AF' }
      },
    ],
  };

  const calculateStats = () => {
    if (trendData.length < 2) return { change: 0, avg: 0, max: 0, min: 0 };
    
    const latest = trendData[trendData.length - 1].total;
    const previous = trendData[trendData.length - 2].total;
    const change = ((latest - previous) / previous * 100);
    const totals = trendData.map(d => d.total);
    
    return {
      change,
      avg: totals.reduce((a, b) => a + b, 0) / totals.length,
      max: Math.max(...totals),
      min: Math.min(...totals),
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">历史数据</h1>
          <p className="text-gray-500 mt-1">查看历史排放趋势和数据分析</p>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          >
            <option value="6">近6个月</option>
            <option value="12">近12个月</option>
            <option value="24">近24个月</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">环比变化</p>
              <p className={`text-2xl font-bold mt-2 ${stats.change >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(1)}%
              </p>
              <p className="text-gray-400 text-xs mt-1">较上期</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.change >= 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              <TrendingUp className={`w-6 h-6 ${stats.change >= 0 ? 'text-red-500 rotate-0' : 'text-emerald-500 rotate-180'}`} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">平均排放</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{(stats.avg / 1000).toFixed(2)}</p>
              <p className="text-gray-400 text-xs mt-1">千吨 CO2e/期</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">最高排放</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{(stats.max / 1000).toFixed(2)}</p>
              <p className="text-gray-400 text-xs mt-1">千吨 CO2e</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">记录期数</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{trendData.length}</p>
              <p className="text-gray-400 text-xs mt-1">期</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">排放趋势分析</h3>
        <ReactECharts option={trendLineOption} style={{ height: '400px' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">本期 vs 上期对比</h3>
          <ReactECharts option={comparisonBarOption} style={{ height: '300px' }} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">历史数据明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">周期</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">范围一</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">范围二</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">范围三</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">总量</th>
                </tr>
              </thead>
              <tbody>
                {trendData.slice().reverse().map((record, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-800">{record.period}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{(record.scope1 / 1000).toFixed(2)}k</td>
                    <td className="py-3 px-4 text-right text-gray-600">{(record.scope2 / 1000).toFixed(2)}k</td>
                    <td className="py-3 px-4 text-right text-gray-600">{(record.scope3 / 1000).toFixed(2)}k</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">{(record.total / 1000).toFixed(2)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
