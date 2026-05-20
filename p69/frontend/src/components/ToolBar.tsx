import React, { useState, useCallback } from 'react';
import { ProcessType } from '../types';

interface ToolBarProps {
  autoAdjustEnabled: boolean;
  onToggleAutoAdjust: (enabled: boolean) => void;
}

const processOptions: { value: ProcessType; label: string }[] = [
  { value: 'soaking', label: '浸泡工序' },
  { value: 'beating', label: '捶打工序' },
  { value: 'papermaking', label: '抄纸工序' },
];

export const ToolBar: React.FC<ToolBarProps> = ({ autoAdjustEnabled, onToggleAutoAdjust }) => {
  const [selectedProcess, setSelectedProcess] = useState<ProcessType>('soaking');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const handleExport = useCallback(() => {
    const now = new Date();
    let start = new Date(now);

    switch (dateRange) {
      case '24h':
        start.setHours(now.getHours() - 24);
        break;
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
    }

    const url = `/api/report/download?process_type=${selectedProcess}&start=${start.toISOString()}&end=${now.toISOString()}&format=${exportFormat}`;
    window.open(url, '_blank');
  }, [selectedProcess, dateRange, exportFormat]);

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <span style={styles.sectionTitle}>📊 数据导出</span>
        <div style={styles.controls}>
          <select
            value={selectedProcess}
            onChange={(e) => setSelectedProcess(e.target.value as ProcessType)}
            style={styles.select}
          >
            {processOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            style={styles.select}
          >
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
          </select>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
            style={styles.select}
          >
            <option value="csv">CSV格式</option>
            <option value="json">JSON格式</option>
          </select>

          <button onClick={handleExport} style={styles.exportButton}>
            导出报表
          </button>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <span style={styles.sectionTitle}>⚙️ 参数自动调整</span>
        <div style={styles.toggleContainer}>
          <button
            onClick={() => onToggleAutoAdjust(!autoAdjustEnabled)}
            style={{
              ...styles.toggleButton,
              ...(autoAdjustEnabled ? styles.toggleActive : styles.toggleInactive),
            }}
          >
            <span style={styles.toggleCircle} />
            <span style={styles.toggleLabel}>
              {autoAdjustEnabled ? '已启用' : '已禁用'}
            </span>
          </button>
          <span style={styles.hint}>
            {autoAdjustEnabled
              ? '系统将根据实时数据自动调整参数阈值'
              : '参数阈值保持固定，需要手动调整'}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#1F2937',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  select: {
    backgroundColor: '#111827',
    color: '#F9FAFB',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  exportButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  divider: {
    width: '1px',
    height: '40px',
    backgroundColor: '#374151',
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10B981',
  },
  toggleInactive: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    color: '#9CA3AF',
  },
  toggleCircle: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  toggleLabel: {
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    color: '#6B7280',
    fontSize: '12px',
  },
};
