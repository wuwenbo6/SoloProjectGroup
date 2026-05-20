import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Leaf, Factory, Zap, Truck, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { EmissionSummary, EmissionTrend, HotspotAnalysis } from '../types';

export function Dashboard() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<EmissionSummary | null>(null);
  const [trendData, setTrendData] = useState<EmissionTrend[]>([]);
  const [hotspots, setHotspots] = useState<HotspotAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryData, trend, hotspotData] = await Promise.all([
        api.getEmissionSummary(user!.company_id),
        api.getEmissionTrend(user!.company_id, 6),
        api.generateDemoData(user!.company_id, '2024-Q1').then(() => 
          api.getEmissionSummary(user!.company_id).then(s => 
            api.getEmissionHotspots(s.id)
          )
        ),
      ]);
      setSummary(summaryData);
      setTrendData(trend);
      setHotspots(hotspotData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const scopePieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} tCO2e ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%' },
      emphasis: { label: { fontSize: 14, fontWeight: 'bold' } },
      data: summary ? [
        { value: summary.scope1, name: '范围一', itemStyle: { color: '#1B4D3E' } },
        { value: summary.scope2, name: '范围二', itemStyle: { color: '#2E8B57' } },
        { value: summary.scope3, name: '范围三', itemStyle: { color: '#3CB371' } },
      ] : [],
    }],
  };

  const trendLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['范围一', '范围二', '范围三'], top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trendData.map(d => d.period) },
    yAxis: { type: 'value', name: 'tCO2e' },
    series: [
      { name: '范围一', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope1), color: '#1B4D3E' },
      { name: '范围二', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope2), color: '#2E8B57' },
      { name: '范围三', type: 'line', stack: 'total', areaStyle: {}, data: trendData.map(d => d.scope3), color: '#3CB371' },
    ],
  };

  const hotspotBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: 'tCO2e' },
    yAxis: { type: 'category', data: hotspots?.hotspots.slice(0, 8).map(h => h.category).reverse() || [] },
    series: [{
      type: 'bar',
      data: hotspots?.hotspots.slice(0, 8).map(h => ({
        value: h.emission,
        itemStyle: { color: h.level === 'high' ? '#E67E22' : h.level === 'medium' ? '#F39C12' : '#3CB371' }
      })).reverse() || [],
      label: { show: true, position: 'right', formatter: '{c}' },
    }],
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">碳排放仪表盘</h1>
          <p className="text-gray-500 mt-1">实时监控您的供应链碳排放数据</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          数据已同步
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">总排放量</p>
              <p className="text-3xl font-bold mt-2">{formatNumber(summary?.total || 0)}</p>
              <p className="text-emerald-100 text-xs mt-1">tCO2e</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Leaf className="w-7 h-7" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm">
            <TrendingDown className="w-4 h-4" />
            <span>较上期 -5.2%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">范围一 (直接排放)</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{formatNumber(summary?.scope1 || 0)}</p>
              <p className="text-gray-400 text-xs mt-1">占比 {summary ? ((summary.scope1 / summary.total) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="w-12 h-12 bg-emerald-900/10 rounded-xl flex items-center justify-center">
              <Factory className="w-6 h-6 text-emerald-900" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">范围二 (间接排放)</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{formatNumber(summary?.scope2 || 0)}</p>
              <p className="text-gray-400 text-xs mt-1">占比 {summary ? ((summary.scope2 / summary.total) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="w-12 h-12 bg-emerald-700/10 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">范围三 (供应链)</p>
              <p className="text-2xl font-bold mt-2 text-gray-800">{formatNumber(summary?.scope3 || 0)}</p>
              <p className="text-gray-400 text-xs mt-1">占比 {summary ? ((summary.scope3 / summary.total) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">排放范围构成</h3>
          </div>
          <ReactECharts option={scopePieOption} style={{ height: '280px' }} />
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">排放趋势</h3>
            <div className="flex gap-2">
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600">
                <option>近6个月</option>
                <option>近12个月</option>
              </select>
            </div>
          </div>
          <ReactECharts option={trendLineOption} style={{ height: '280px' }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">排放热点分布</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <ReactECharts option={hotspotBarOption} style={{ height: '320px' }} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">主要排放源明细</h3>
          <div className="space-y-3">
            {hotspots?.hotspots.slice(0, 6).map((hotspot, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                  hotspot.level === 'high' ? 'bg-orange-500' : 
                  hotspot.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{hotspot.category}</span>
                    <span className="text-sm font-semibold text-gray-700">{formatNumber(hotspot.emission)} t</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        hotspot.level === 'high' ? 'bg-orange-500' : 
                        hotspot.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${hotspot.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{hotspot.percentage}%</span>
                    <span className={`${
                      hotspot.level === 'high' ? 'text-orange-600' : 
                      hotspot.level === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {hotspot.level === 'high' ? '高排放' : hotspot.level === 'medium' ? '中排放' : '低排放'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
