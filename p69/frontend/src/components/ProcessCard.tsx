import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SensorData, ProcessType } from '../types';

interface ProcessCardProps {
  title: string;
  processType: ProcessType;
  data: SensorData[];
  icon: string;
}

const processNames: Record<ProcessType, string> = {
  soaking: '浸泡工序',
  beating: '捶打工序',
  papermaking: '抄纸工序',
};

const ProcessCardComponent: React.FC<ProcessCardProps> = ({ title, processType, data, icon }) => {
  const latestData = data[0];

  const chartData = useMemo(() => {
    return data.slice(0, 20).reverse().map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temperature: d.temperature?.toFixed(1),
      ph_value: d.ph_value?.toFixed(2),
      concentration: d.concentration?.toFixed(2),
      speed: d.speed?.toFixed(1),
    }));
  }, [data]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.icon}>{icon}</span>
        <h3 style={styles.title}>{title}</h3>
        {latestData && (
          <span style={styles.status}>
            实时更新中
          </span>
        )}
      </div>

      {latestData && (
        <>
          <div style={styles.metricsGrid}>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>温度</span>
              <span style={styles.metricValue}>{latestData.temperature?.toFixed(1)}°C</span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>湿度</span>
              <span style={styles.metricValue}>{latestData.humidity?.toFixed(1)}%</span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>pH值</span>
              <span style={styles.metricValue}>{latestData.ph_value?.toFixed(2)}</span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>浓度</span>
              <span style={styles.metricValue}>{latestData.concentration?.toFixed(2)}%</span>
            </div>
            {processType !== 'soaking' && (
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>速度</span>
                <span style={styles.metricValue}>{latestData.speed?.toFixed(1)} rpm</span>
              </div>
            )}
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>设备</span>
              <span style={styles.metricValue}>{latestData.device_id}</span>
            </div>
          </div>

          <div style={styles.chartContainer}>
            <h4 style={styles.chartTitle}>温度趋势</h4>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} />
                <YAxis stroke="#9CA3AF" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#E5E7EB' }}
                />
                <Line type="monotone" dataKey="temperature" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!latestData && (
        <div style={styles.loading}>
          <span>等待数据...</span>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#1F2937',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #374151',
  },
  icon: {
    fontSize: '28px',
  },
  title: {
    margin: 0,
    color: '#F9FAFB',
    fontSize: '18px',
    fontWeight: 600,
    flex: 1,
  },
  status: {
    color: '#10B981',
    fontSize: '12px',
    padding: '4px 12px',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: '12px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '15px',
    marginBottom: '20px',
  },
  metricItem: {
    backgroundColor: '#111827',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  metricLabel: {
    display: 'block',
    color: '#9CA3AF',
    fontSize: '12px',
    marginBottom: '6px',
  },
  metricValue: {
    display: 'block',
    color: '#F9FAFB',
    fontSize: '16px',
    fontWeight: 600,
  },
  chartContainer: {
    backgroundColor: '#111827',
    padding: '15px',
    borderRadius: '8px',
  },
  chartTitle: {
    margin: '0 0 10px 0',
    color: '#9CA3AF',
    fontSize: '14px',
    fontWeight: 500,
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#9CA3AF',
  },
};

export const ProcessCard = React.memo(ProcessCardComponent, (prev, next) => {
  if (prev.data.length === 0 && next.data.length === 0) return true;
  if (prev.data.length === 0 || next.data.length === 0) return false;
  return prev.data[0]?.id === next.data[0]?.id;
});
