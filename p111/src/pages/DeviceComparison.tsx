import { useEffect, useState } from 'react';
import { Layers, Thermometer, Droplets, Wind, Clock, TrendingUp, Activity, RefreshCw } from 'lucide-react';
import { DeviceData } from '../../shared/types';
import { useMonitorStore } from '../store/monitorStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

const statusConfig = {
  running: { label: '运行中', color: '#10b981', bgColor: 'bg-emerald-500/10' },
  idle: { label: '待机', color: '#64748b', bgColor: 'bg-slate-500/10' },
  warning: { label: '警告', color: '#f59e0b', bgColor: 'bg-amber-500/10' },
  error: { label: '故障', color: '#ef4444', bgColor: 'bg-red-500/10' },
};

export const DeviceComparison = () => {
  const [loading, setLoading] = useState(true);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const { deviceList, setDeviceList } = useMonitorStore();

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/devices');
      const data = await response.json();
      setDeviceList(data);
      if (selectedDevices.length === 0 && data.length > 0) {
        setSelectedDevices(data.map((d: DeviceData) => d.id));
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const chartData = deviceList
    .filter((d) => selectedDevices.includes(d.id))
    .map((device) => ({
      name: device.name,
      温度: device.currentData.temperature,
      湿度: device.currentData.humidity,
      氧浓度: device.currentData.oxygen,
      发酵时间: device.currentData.fermentationTime,
      品质评分: device.qualityScore,
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Layers className="w-12 h-12 text-blue-400 animate-pulse" />
          <p className="text-slate-400">加载设备数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">多设备对比</h1>
            </div>
            <p className="text-slate-400">实时监控与对比多台发酵设备运行状态</p>
          </div>
          <button
            onClick={fetchDevices}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新数据
          </button>
        </div>

        {/* 设备选择器 */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            选择对比设备
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {deviceList.map((device) => (
              <button
                key={device.id}
                onClick={() => toggleDevice(device.id)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedDevices.includes(device.id)
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{device.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${statusConfig[device.status].bgColor}`}
                    style={{ color: statusConfig[device.status].color }}
                  >
                    {statusConfig[device.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>品质评分: {device.qualityScore}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 参数对比柱状图 */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-emerald-400" />
            工艺参数对比
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="温度" fill="#10b981" radius={[4, 4, 0, 0]} name="温度(℃)" />
                <Bar dataKey="湿度" fill="#3b82f6" radius={[4, 4, 0, 0]} name="湿度(%)" />
                <Bar dataKey="氧浓度" fill="#f59e0b" radius={[4, 4, 0, 0]} name="氧浓度(%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 品质评分对比 */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            品质评分对比
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value} 分`, '品质评分']}
                />
                <Bar dataKey="品质评分" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <text key={`label-${index}`} x={entry.品质评分 + 5} y={(index + 0.5) * 64} fill="#94a3b8" fontSize={12}>
                      {entry.品质评分}
                    </text>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 设备详情卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {deviceList
            .filter((d) => selectedDevices.includes(d.id))
            .map((device) => (
              <div
                key={device.id}
                className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[device.status].bgColor}`}
                    style={{ color: statusConfig[device.status].color }}
                  >
                    {statusConfig[device.status].label}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-sm">温度</span>
                    </div>
                    <span className="text-white font-medium">{device.currentData.temperature.toFixed(2)}℃</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-400 text-sm">湿度</span>
                    </div>
                    <span className="text-white font-medium">{device.currentData.humidity.toFixed(2)}%</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-amber-400" />
                      <span className="text-slate-400 text-sm">氧浓度</span>
                    </div>
                    <span className="text-white font-medium">{device.currentData.oxygen.toFixed(2)}%</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-slate-400 text-sm">发酵时间</span>
                    </div>
                    <span className="text-white font-medium">{device.currentData.fermentationTime.toFixed(2)}h</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 text-sm">品质评分</span>
                    </div>
                    <span className="text-emerald-400 font-bold text-lg">{device.qualityScore}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
