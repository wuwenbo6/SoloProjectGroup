import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8080/api';

function AdaptiveSampleRate() {
  const [stats, setStats] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorDetail, setSensorDetail] = useState(null);

  const fetchStatistics = async () => {
    try {
      const res = await fetch(`${API_BASE}/sample-rates/statistics`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch sample rate stats:', err);
    }
  };

  const fetchSensorDetail = async (sensorID) => {
    try {
      const res = await fetch(`${API_BASE}/sensors/${sensorID}/sample-rate`);
      const data = await res.json();
      setSensorDetail(data);
    } catch (err) {
      console.error('Failed to fetch sensor sample rate:', err);
    }
  };

  useEffect(() => {
    fetchStatistics();
    const interval = setInterval(fetchStatistics, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedSensor) {
      fetchSensorDetail(selectedSensor);
      const interval = setInterval(() => fetchSensorDetail(selectedSensor), 1000);
      return () => clearInterval(interval);
    }
  }, [selectedSensor]);

  const styles = {
    container: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '15px',
      marginBottom: '20px',
    },
    statCard: (isLow) => ({
      padding: '15px',
      borderRadius: '8px',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderLeft: `4px solid ${isLow ? '#ffaa00' : '#00ff88'}`,
    }),
    statValue: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#fff',
    },
    statLabel: {
      fontSize: '12px',
      color: '#888',
      marginTop: '5px',
    },
    legendBox: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px',
      marginBottom: '15px',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: '8px',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13px',
      color: '#ccc',
    },
    legendDot: (color) => ({
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 6px ${color}`,
    }),
    sensorList: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '8px',
      maxHeight: '200px',
      overflowY: 'auto',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: '8px',
    },
    sensorItem: (isLow, isSelected) => ({
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      cursor: 'pointer',
      backgroundColor: isSelected ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.2)',
      border: `2px solid ${isSelected ? '#00d4ff' : 'transparent'}`,
      borderLeft: `3px solid ${isLow ? '#ffaa00' : '#00ff88'}`,
      color: '#fff',
      transition: 'all 0.2s',
    }),
    detailPanel: {
      marginTop: '15px',
      padding: '15px',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
    },
    detailTitle: {
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: '10px',
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px',
    },
    detailItem: {
      padding: '8px',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: '6px',
    },
    detailLabel: {
      fontSize: '11px',
      color: '#888',
    },
    detailValue: {
      fontSize: '14px',
      color: '#fff',
      fontWeight: 'bold',
    },
    thresholdInfo: {
      marginTop: '15px',
      padding: '12px',
      backgroundColor: 'rgba(255,170,0,0.1)',
      borderRadius: '8px',
      borderLeft: '3px solid #ffaa00',
      fontSize: '12px',
      color: '#ccc',
    },
  };

  if (!stats) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>📊 自适应采样率</h2>
        <p style={{color: '#888'}}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📊 自适应采样率</h2>

      <div style={styles.statsGrid}>
        <div style={styles.statCard(false)}>
          <div style={{...styles.statValue, color: '#00ff88'}}>{stats.high_rate_count || 0}</div>
          <div style={styles.statLabel}>高频采样 (100ms)</div>
        </div>
        <div style={styles.statCard(true)}>
          <div style={{...styles.statValue, color: '#ffaa00'}}>{stats.low_rate_count || 0}</div>
          <div style={styles.statLabel}>低频采样 (500ms)</div>
        </div>
        <div style={styles.statCard(false)}>
          <div style={{...styles.statValue, color: '#00d4ff'}}>
            {stats.bandwidth_saved_percent?.toFixed(1) || 0}%
          </div>
          <div style={styles.statLabel}>预计带宽节省</div>
        </div>
        <div style={styles.statCard(false)}>
          <div style={{...styles.statValue, color: '#fff'}}>
            {(stats.avg_temp_variance || 0).toFixed(4)}
          </div>
          <div style={styles.statLabel}>平均温度方差</div>
        </div>
      </div>

      <div style={styles.legendBox}>
        <div style={styles.legendItem}>
          <span style={styles.legendDot('#00ff88')}></span>
          <span>高频采样: 数据变化大，采样率 100ms</span>
        </div>
        <div style={styles.legendItem}>
          <span style={styles.legendDot('#ffaa00')}></span>
          <span>低频采样: 数据稳定，采样率 500ms</span>
        </div>
      </div>

      <div style={{color: '#ccc', fontSize: '13px', marginBottom: '8px'}}>
        传感器状态列表 (点击查看详情):
      </div>
      <div style={styles.sensorList}>
        {stats.sensor_rates && Object.entries(stats.sensor_rates).map(([sensorID, rate]) => (
          <div
            key={sensorID}
            style={styles.sensorItem(rate === 500, selectedSensor === sensorID)}
            onClick={() => setSelectedSensor(sensorID === selectedSensor ? null : sensorID)}
          >
            {sensorID.replace('sensor_', 'S')}
            <span style={{float: 'right', opacity: 0.7}}>
              {rate === 500 ? '500ms' : '100ms'}
            </span>
          </div>
        ))}
      </div>

      {sensorDetail && (
        <div style={styles.detailPanel}>
          <div style={styles.detailTitle}>
            📍 {sensorDetail.sensor_id} 详情
          </div>
          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>当前采样率</div>
              <div style={{...styles.detailValue, color: sensorDetail.is_low_rate ? '#ffaa00' : '#00ff88'}}>
                {sensorDetail.current_rate_ms}ms
                {sensorDetail.is_low_rate ? ' (低频)' : ' (高频)'}
              </div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>采样模式</div>
              <div style={styles.detailValue}>
                {sensorDetail.is_low_rate ? '带宽节省模式' : '高精度模式'}
              </div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>温度方差</div>
              <div style={styles.detailValue}>
                {(sensorDetail.temp_variance || 0).toFixed(4)}
              </div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>湿度方差</div>
              <div style={styles.detailValue}>
                {(sensorDetail.humidity_variance || 0).toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.thresholdInfo}>
        <strong>💡 切换阈值:</strong>
        <br/>• 降低采样率: 温度方差 ≤ 0.1 且 湿度方差 ≤ 0.5
        <br/>• 恢复采样率: 温度方差 ≥ 0.5 或 湿度方差 ≥ 2.0
        <br/>• 防抖机制: 状态稳定观察 3秒 后才切换
      </div>
    </div>
  );
}

export default AdaptiveSampleRate;
