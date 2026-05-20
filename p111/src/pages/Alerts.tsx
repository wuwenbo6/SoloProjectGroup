import { AlertTriangle, Check, Filter } from 'lucide-react';
import { useState } from 'react';
import { useMonitorStore } from '../store/monitorStore';
import { Alert as AlertType } from '../../shared/types';

export const Alerts = () => {
  const { alerts, acknowledgeAlert } = useMonitorStore();
  const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(true);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter !== 'all' && alert.level !== filter) return false;
    if (!showAcknowledged && alert.acknowledged) return false;
    return true;
  });

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert(id);
    fetch(`http://localhost:3001/api/alerts/${id}/acknowledge`, { method: 'PUT' }).catch(
      console.error
    );
  };

  const getTypeLabel = (type: AlertType['type']) => {
    const labels = {
      temperature: '温度',
      humidity: '湿度',
      oxygen: '氧浓度',
    };
    return labels[type];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">告警中心</h1>
          <p className="text-slate-400">查看和管理所有告警记录</p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm">级别筛选:</span>
          </div>
          {(['all', 'warning', 'critical'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === level
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {level === 'all' ? '全部' : level === 'warning' ? '警告' : '严重'}
            </button>
          ))}

          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-sm">显示已确认</span>
          </label>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">时间</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">类型</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">级别</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">消息</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">值/阈值</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">状态</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无告警记录</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${
                      alert.acknowledged ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {new Date(alert.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{getTypeLabel(alert.type)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.level === 'critical'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {alert.level === 'critical' ? '严重' : '警告'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{alert.message}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {alert.value.toFixed(2)} / {alert.threshold}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.acknowledged
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {alert.acknowledged ? '已确认' : '待处理'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm"
                        >
                          <Check className="w-4 h-4" />
                          确认
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
