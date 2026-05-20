import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const AlertList = ({ alerts, onResolve }) => {
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error': return <AlertCircle size={20} color="#f44336" />;
      case 'warning': return <AlertTriangle size={20} color="#ff9800" />;
      default: return <Info size={20} color="#2196f3" />;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN');
  };

  const unresolvedAlerts = alerts.filter(a => !a.is_resolved);

  return (
    <div className="alert-list">
      {unresolvedAlerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
          <Info size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>暂无警报</p>
        </div>
      ) : (
        unresolvedAlerts.map((alert) => (
          <div key={alert.id} className={`alert-item ${getSeverityClass(alert.severity)}`}>
            {getSeverityIcon(alert.severity)}
            <div className="alert-content">
              <h4>{alert.alert_type}</h4>
              <p>{alert.message || '暂无详细信息'}</p>
              <div className="alert-time">{formatTime(alert.created_at)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AlertList;