import React, { useMemo } from 'react';
import { DiagnosticResult } from '../types';

interface DiagnosticPanelProps {
  diagnostics: DiagnosticResult[];
}

const processNames: Record<string, string> = {
  soaking: '浸泡工序',
  beating: '捶打工序',
  papermaking: '抄纸工序',
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  normal: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: '#10B981' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', border: '#F59E0B' },
  critical: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: '#EF4444' },
  offline: { bg: 'rgba(107, 114, 128, 0.1)', text: '#6B7280', border: '#6B7280' },
};

const statusLabels: Record<string, string> = {
  normal: '正常',
  warning: '警告',
  critical: '严重',
  offline: '离线',
};

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ diagnostics }) => {
  const overallHealth = useMemo(() => {
    if (diagnostics.length === 0) return 0;
    const sum = diagnostics.reduce((acc, d) => acc + d.health_score, 0);
    return Math.round(sum / diagnostics.length);
  }, [diagnostics]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🏥 设备健康诊断</h3>
        <div style={{ ...styles.overallScore, ...statusColors[overallHealth > 80 ? 'normal' : overallHealth > 60 ? 'warning' : 'critical'] }}>
          <span style={styles.overallLabel}>综合健康分</span>
          <span style={styles.scoreValue}>{overallHealth}</span>
        </div>
      </div>

      <div style={styles.deviceList}>
        {diagnostics.map((diag) => {
          const colors = statusColors[diag.status] || statusColors.offline;
          return (
            <div key={diag.device_id} style={{ ...styles.deviceCard, borderLeftColor: colors.border }}>
              <div style={styles.deviceHeader}>
                <span style={styles.deviceName}>{diag.device_id}</span>
                <span style={{ ...styles.statusBadge, backgroundColor: colors.bg, color: colors.text }}>
                  {statusLabels[diag.status] || diag.status}
                </span>
                <span style={styles.healthScore}>
                  {Math.round(diag.health_score)}分
                </span>
              </div>

              <div style={styles.processTag}>
                {processNames[diag.process_type] || diag.process_type}
              </div>

              {diag.issues.length > 0 && (
                <div style={styles.issuesList}>
                  {diag.issues.slice(0, 3).map((issue, idx) => (
                    <div key={idx} style={styles.issueItem}>
                      <span style={styles.issueSeverity(issue.severity)}>
                        {issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️'}
                      </span>
                      <span style={styles.issueText}>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {diag.suggestions.length > 0 && (
                <div style={styles.suggestions}>
                  <span style={styles.suggestionLabel}>建议: </span>
                  <span style={styles.suggestionText}>{diag.suggestions[0]}</span>
                </div>
              )}

              <div style={styles.lastCheck}>
                最后检查: {new Date(diag.last_check).toLocaleTimeString('zh-CN')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#1F2937',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #374151',
  },
  title: {
    margin: 0,
    color: '#F9FAFB',
    fontSize: '18px',
    fontWeight: 600,
  },
  overallScore: {
    padding: '8px 16px',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  overallLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#9CA3AF',
    marginBottom: '4px',
  },
  scoreValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 700,
  },
  deviceList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  deviceCard: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    padding: '15px',
    borderLeft: '4px solid',
  },
  deviceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  deviceName: {
    color: '#F9FAFB',
    fontWeight: 600,
    fontSize: '14px',
  },
  statusBadge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  healthScore: {
    marginLeft: 'auto',
    color: '#9CA3AF',
    fontSize: '14px',
    fontWeight: 500,
  },
  processTag: {
    color: '#60A5FA',
    fontSize: '12px',
    marginBottom: '10px',
  },
  issuesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginBottom: '10px',
  },
  issueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  issueSeverity: (severity: string) => ({
    fontSize: '14px',
  }),
  issueText: {
    color: '#D1D5DB',
  },
  suggestions: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '8px',
  },
  suggestionLabel: {
    color: '#60A5FA',
    fontWeight: 500,
  },
  suggestionText: {
    color: '#93C5FD',
  },
  lastCheck: {
    color: '#6B7280',
    fontSize: '11px',
    textAlign: 'right' as const,
  },
};
