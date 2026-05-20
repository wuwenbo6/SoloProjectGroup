import React, { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

const GATEWAY_API = 'http://localhost:8080';

function SensorTopology({ onSensorSelect }) {
  const [sensorStatus, setSensorStatus] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [statusStats, setStatusStats] = useState({ normal: 0, missing: 0, anomaly: 0 });

  const fetchSensorStatus = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_API}/api/sensors/status`);
      const data = await res.json();
      setSensorStatus(data.sensors || []);
      
      const stats = { normal: 0, missing: 0, anomaly: 0 };
      (data.sensors || []).forEach(s => {
        if (stats[s.status] !== undefined) {
          stats[s.status]++;
        }
      });
      setStatusStats(stats);
    } catch (err) {
      console.error('Failed to fetch sensor status:', err);
    }
  }, []);

  const fetchSensorLogs = useCallback(async (sensorID) => {
    try {
      const res = await fetch(`${GATEWAY_API}/api/sensors/${sensorID}/logs?limit=100`);
      const data = await res.json();
      setLogs(data.logs || []);
      setShowLogs(true);
    } catch (err) {
      console.error('Failed to fetch sensor logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchSensorStatus();
    const interval = setInterval(fetchSensorStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchSensorStatus]);

  const handleSensorClick = (sensor) => {
    setSelectedSensor(sensor);
    if (onSensorSelect) {
      onSensorSelect(sensor.sensor_id);
    }
    fetchSensorLogs(sensor.sensor_id);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'normal': return '#00ff88';
      case 'missing': return '#ffaa00';
      case 'anomaly': return '#ff4444';
      default: return '#666666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'normal': return '正常';
      case 'missing': return '缺失';
      case 'anomaly': return '异常';
      default: return '未知';
    }
  };

  const generateTopologyOption = () => {
    const nodes = sensorStatus.map((sensor, idx) => {
      const row = Math.floor(idx / 10);
      const col = idx % 10;
      return {
        id: sensor.sensor_id,
        name: sensor.sensor_id.replace('sensor_', ''),
        x: 80 + col * 90,
        y: 80 + row * 90,
        symbolSize: 50,
        itemStyle: {
          color: getStatusColor(sensor.status),
          shadowBlur: 10,
          shadowColor: getStatusColor(sensor.status),
        },
        label: {
          show: true,
          color: '#fff',
          fontSize: 10,
        },
        status: sensor.status,
        temp: sensor.current_temp?.toFixed(1),
        humidity: sensor.current_humidity?.toFixed(1),
      };
    });

    const links = [];
    for (let i = 1; i < Math.min(nodes.length, 10); i++) {
      links.push({
        source: nodes[0].id,
        target: nodes[i].id,
        lineStyle: { color: 'rgba(255,255,255,0.1)' }
      });
    }
    for (let row = 1; row < 5; row++) {
      for (let col = 0; col < 10; col++) {
        const idx = row * 10 + col;
        if (idx < nodes.length) {
          links.push({
            source: nodes[col].id,
            target: nodes[idx].id,
            lineStyle: { color: 'rgba(255,255,255,0.1)' }
          });
        }
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'node') {
            return `
              <div style="padding: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${params.data.id}</div>
                <div>状态: ${getStatusText(params.data.status)}</div>
                <div>温度: ${params.data.temp}°C</div>
                <div>湿度: ${params.data.humidity}%</div>
              </div>
            `;
          }
          return '';
        },
        backgroundColor: 'rgba(20, 30, 60, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      series: [{
        type: 'graph',
        layout: 'none',
        roam: true,
        zoom: 1.1,
        label: { show: true },
        edgeSymbol: ['none', 'none'],
        data: nodes,
        links: links,
        lineStyle: { color: 'rgba(255,255,255,0.1)', width: 1 }
      }]
    };
  };

  const onChartClick = (params) => {
    if (params.dataType === 'node') {
      const sensor = sensorStatus.find(s => s.sensor_id === params.data.id);
      if (sensor) {
        handleSensorClick(sensor);
      }
    }
  };

  const styles = {
    container: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px'
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#fff'
    },
    legend: {
      display: 'flex',
      gap: '20px'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#aaa'
    },
    legendDot: (status) => ({
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: getStatusColor(status),
      boxShadow: `0 0 6px ${getStatusColor(status)}`
    }),
    statsBar: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      marginBottom: '15px'
    },
    statItem: {
      padding: '10px',
      textAlign: 'center',
      borderRadius: '8px',
      backgroundColor: 'rgba(0,0,0,0.2)'
    },
    statValue: {
      fontSize: '20px',
      fontWeight: 'bold'
    },
    statLabel: {
      fontSize: '11px',
      color: '#888',
      marginTop: '4px'
    },
    logsPanel: {
      backgroundColor: '#0d1424',
      borderRadius: '8px',
      padding: '15px',
      marginTop: '15px',
      maxHeight: '300px',
      overflowY: 'auto'
    },
    logsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px'
    },
    logsTitle: {
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#fff'
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#888',
      cursor: 'pointer',
      fontSize: '16px'
    },
    logItem: {
      padding: '8px 10px',
      marginBottom: '6px',
      borderRadius: '6px',
      fontSize: '12px',
      borderLeft: '3px solid'
    },
    logData: {
      backgroundColor: 'rgba(0, 212, 255, 0.1)',
      borderColor: '#00d4ff'
    },
    logAlert: {
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      borderColor: '#ff6b6b'
    },
    logInterpolated: {
      backgroundColor: 'rgba(255, 170, 0, 0.1)',
      borderColor: '#ffaa00'
    },
    logTime: {
      color: '#666',
      fontSize: '11px'
    },
    logContent: {
      color: '#ccc',
      marginTop: '2px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔌 传感器拓扑图</h2>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={styles.legendDot('normal')}></span>
            <span>正常</span>
          </div>
          <div style={styles.legendItem}>
            <span style={styles.legendDot('missing')}></span>
            <span>缺失</span>
          </div>
          <div style={styles.legendItem}>
            <span style={styles.legendDot('anomaly')}></span>
            <span>异常</span>
          </div>
        </div>
      </div>

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <div style={{...styles.statValue, color: getStatusColor('normal')}}>
            {statusStats.normal}
          </div>
          <div style={styles.statLabel}>正常运行</div>
        </div>
        <div style={styles.statItem}>
          <div style={{...styles.statValue, color: getStatusColor('missing')}}>
            {statusStats.missing}
          </div>
          <div style={styles.statLabel}>数据缺失</div>
        </div>
        <div style={styles.statItem}>
          <div style={{...styles.statValue, color: getStatusColor('anomaly')}}>
            {statusStats.anomaly}
          </div>
          <div style={styles.statLabel}>异常告警</div>
        </div>
      </div>

      <ReactECharts
        option={generateTopologyOption()}
        style={{ height: '450px' }}
        onEvents={{ click: onChartClick }}
        opts={{ renderer: 'canvas' }}
      />

      {showLogs && selectedSensor && (
        <div style={styles.logsPanel}>
          <div style={styles.logsHeader}>
            <span style={styles.logsTitle}>📋 {selectedSensor.sensor_id} 详细日志</span>
            <button style={styles.closeBtn} onClick={() => setShowLogs(false)}>✕</button>
          </div>
          <div>
            {logs.slice(0, 30).map((log, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.logItem,
                  ...(log.type === 'alert' ? styles.logAlert : 
                     log.is_interpolated ? styles.logInterpolated : styles.logData)
                }}
              >
                <div style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                <div style={styles.logContent}>
                  {log.type === 'alert' ? (
                    <span>⚠️ {log.message}</span>
                  ) : (
                    <span>
                      🌡️ {log.temp}°C | 💧 {log.humidity}%
                      {log.is_interpolated && (
                        <span style={{color: '#ffaa00', marginLeft: '8px'}}>
                          [插值数据 - 缺失{log.missing_duration_ms}ms]
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SensorTopology;
