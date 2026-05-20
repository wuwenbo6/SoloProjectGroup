import { AlertTriangle, X } from 'lucide-react';
import { useMonitorStore } from '../store/monitorStore';
import { useMemo } from 'react';

export const AlertBanner = () => {
  const alerts = useMonitorStore((state) => state.alerts);
  const acknowledgeAlert = useMonitorStore((state) => state.acknowledgeAlert);

  // 去重：按类型和级别分组，只显示最新的
  const unacknowledgedAlerts = useMemo(() => {
    const seen = new Set<string>();
    return alerts
      .filter((a) => !a.acknowledged)
      .filter((a) => {
        const key = `${a.type}-${a.level}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [alerts]);

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert(id);
    fetch(`http://localhost:3001/api/alerts/${id}/acknowledge`, { method: 'PUT' }).catch(
      console.error
    );
  };

  if (unacknowledgedAlerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {unacknowledgedAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-300 ${
            alert.level === 'critical'
              ? 'bg-red-500/90 border border-red-400/50'
              : 'bg-amber-500/90 border border-amber-400/50'
          }`}
        >
          <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{alert.message}</p>
            <p className="text-white/80 text-xs mt-0.5">
              当前值: {alert.value.toFixed(2)} | 阈值: {alert.threshold}
            </p>
            <p className="text-white/60 text-xs mt-1">
              {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
            </p>
          </div>
          <button
            onClick={() => handleAcknowledge(alert.id)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
};
