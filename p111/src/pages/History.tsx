import { Search, Download, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SensorData } from '../../shared/types';

export const History = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dataType, setDataType] = useState<'all' | 'temperature' | 'humidity' | 'oxygen'>('all');
  const [historyData, setHistoryData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startTime', startDate);
      if (endDate) params.append('endTime', endDate);

      const response = await fetch(`http://localhost:3001/api/sensor/history?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      setHistoryData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setHistoryData([]);
    }
    setLoading(false);
  };

  const chartData = historyData.slice(-100).map((data) => ({
    time: new Date(data.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    温度: data.temperature,
    湿度: data.humidity,
    氧浓度: data.oxygen,
  }));

  const exportCSV = () => {
    const headers = ['时间', '温度(℃)', '湿度(%)', '氧浓度(%)', '发酵时间(小时)'];
    const rows = historyData.map((data) => [
      new Date(data.timestamp).toLocaleString('zh-CN'),
      data.temperature.toFixed(2),
      data.humidity.toFixed(2),
      data.oxygen.toFixed(2),
      data.fermentationTime.toFixed(2),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `发酵监控数据_${new Date().toLocaleDateString('zh-CN')}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">历史数据查询</h1>
          <p className="text-slate-400">查询和导出历史监控数据</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-400">至</span>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">数据类型:</span>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value as any)}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">全部</option>
                <option value="temperature">温度</option>
                <option value="humidity">湿度</option>
                <option value="oxygen">氧浓度</option>
              </select>
            </div>

            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              查询
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors ml-auto"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">历史趋势图</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={{ stroke: '#475569' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={{ stroke: '#475569' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  itemStyle={{ color: '#cbd5e1' }}
                />
                <Legend />
                {(dataType === 'all' || dataType === 'temperature') && (
                  <Line
                    type="monotone"
                    dataKey="温度"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {(dataType === 'all' || dataType === 'humidity') && (
                  <Line
                    type="monotone"
                    dataKey="湿度"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {(dataType === 'all' || dataType === 'oxygen') && (
                  <Line
                    type="monotone"
                    dataKey="氧浓度"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-white">数据列表</h3>
            <p className="text-slate-400 text-sm mt-1">共 {historyData.length} 条记录</p>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="border-b border-slate-700/30">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">时间</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">温度(℃)</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">湿度(%)</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">氧浓度(%)</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">发酵时间(小时)</th>
                </tr>
              </thead>
              <tbody>
                {historyData.slice(-50).reverse().map((data) => (
                  <tr key={data.id} className="border-b border-slate-700/20 hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-3 text-sm text-slate-300">
                      {new Date(data.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-300">{data.temperature.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-slate-300">{data.humidity.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-slate-300">{data.oxygen.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-slate-300">{data.fermentationTime.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
