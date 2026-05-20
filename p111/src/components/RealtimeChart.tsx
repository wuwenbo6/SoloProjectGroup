import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMonitorStore } from '../store/monitorStore';
import { useMemo } from 'react';

export const RealtimeChart = () => {
  const historyData = useMonitorStore((state) => state.historyData);

  const chartData = useMemo(() => {
    return historyData.slice(-60).map((data) => ({
      time: new Date(data.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      温度: data.temperature,
      湿度: data.humidity,
      氧浓度: data.oxygen,
    }));
  }, [historyData]);

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">实时趋势曲线</h3>
          <p className="text-slate-400 text-sm mt-1">最近60秒数据</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-300">温度</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-slate-300">湿度</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-slate-300">氧浓度</span>
          </div>
        </div>
      </div>

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
            <Line
              type="monotone"
              dataKey="温度"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#10b981' }}
            />
            <Line
              type="monotone"
              dataKey="湿度"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
            <Line
              type="monotone"
              dataKey="氧浓度"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
