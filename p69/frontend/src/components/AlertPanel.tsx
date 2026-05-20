import React from 'react';
import { Alert, AlertLevel } from '../types';
import { alertAPI } from '../services/api';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge?: () => void;
}

const alertLevelConfig: Record<AlertLevel, { color: string; bgColor: string; label: string }> = {
  info: { color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)', label: '信息' },
  warning: { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)', label: '警告' },
  error: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)', label: '错误' },
  critical: { color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.3)', label: '严重' },
};

const processNames: Record<string, string> = {
  soaking: '浸泡',
  beating: '捶打',
  papermaking: '抄纸',
};

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onAcknowledge }) => {
  const handleAcknowledge = async (id: number) => {
    try {
      await alertAPI.acknowledge(id);
      onAcknowledge?.();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>⚠️ 异常预警</h3>
        {unacknowledgedAlerts.length > 0 && (
          <span style={styles.badge}>{unacknowledgedAlerts.length}</span>
        )}
      </div>

      <div style={styles.alertList}>
        {alerts.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyIcon}>✅</span>
            <p style={styles.emptyText}>暂无异常预警</p>
          </div>
        ) : (
          alerts.slice(0, 10).map((alert) => {
            const config = alertLevelConfig[alert.alert_level];
            return (
              <div
                key={alert.id}
                style={{
                  ...styles.alertItem,
                  borderLeftColor: config.color,
                  opacity: alert.acknowledged ? 0.5 : 1,
                }}
              >
                <div style={styles.alertHeader}>
                  <span style={{ ...styles.alertLevel, backgroundColor: config.bgColor, color: config.color }}>
                    {config.label}
                  </span>
                  <span style={styles.alertProcess}>
                    {processNames[alert.process_type] || alert.process_type}
                  </span>
                  <span style={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
                <p style={styles.alertMessage}>{alert.message}</p>
                <div style={styles.alertDetails}>
                  <span style={styles.alertParam}>{alert.parameter}</span>
                  <span style={styles.alertValue}>
                    当前: {alert.value.toFixed(2)} / 阈值: {alert.threshold.toFixed(2)}
                  </span>
                </div>
                {!alert.acknowledged && (
                  <button
                    style={styles.ackButton}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    确认处理
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#1F2937',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #374151',
  },
  title: {
    margin: 0,
    color: '#F9FAFB',
    fontSize: '18px',
    fontWeight: 600,
    flex: 1,
  },
  badge: {
    backgroundColor: '#EF4444',
    color: 'white',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '12px',
  },
  alertList: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  alertItem: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    padding: '15px',
    borderLeft: '4px solid',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  alertLevel: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  alertProcess: {
    color: '#9CA3AF',
    fontSize: '12px',
  },
  alertTime: {
    color: '#6B7280',
    fontSize: '11px',
    marginLeft: 'auto',
  },
  alertMessage: {
    margin: '0 0 8px 0',
    color: '#F9FAFB',
    fontSize: '14px',
  },
  alertDetails: {
    display: 'flex',
    gap: '15px',
    marginBottom: '10px',
  },
  alertParam: {
    color: '#60A5FA',
    fontSize: '12px',
  },
  alertValue: {
    color: '#9CA3AF',
    fontSize: '12px',
  },
  ackButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '6px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '10px',
  },
  emptyText: {
    color: '#9CA3AF',
    margin: 0,
  },
};
