import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, X, Bell } from 'lucide-react';

const AlertPanel = ({ alerts, onDismiss }) => {
  const [showPanel, setShowPanel] = useState(true);

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'timeout':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      default:
        return <AlertCircle className="w-5 h-5 text-primary" />;
    }
  };

  const getAlertBg = (type) => {
    switch (type) {
      case 'error':
        return 'bg-danger/10 border-danger/30';
      case 'warning':
        return 'bg-warning/10 border-warning/30';
      case 'timeout':
        return 'bg-danger/10 border-danger/30';
      default:
        return 'bg-primary/10 border-primary/30';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-dark-2" />
          <h2 className="text-lg font-semibold text-dark">告警信息</h2>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-danger text-white text-xs rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="text-sm text-primary hover:underline"
        >
          {showPanel ? '收起' : '展开'}
        </button>
      </div>

      {showPanel && (
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-dark-2">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无告警信息</p>
            </div>
          ) : (
            alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertBg(alert.alert_type)}`}
              >
                {getAlertIcon(alert.alert_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark">{alert.message}</p>
                  <p className="text-xs text-dark-2 mt-0.5">
                    设备: {alert.device_id} · {new Date(alert.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(index)}
                  className="text-dark-2 hover:text-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AlertPanel;