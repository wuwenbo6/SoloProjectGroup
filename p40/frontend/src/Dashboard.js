import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import SensorTopology from './SensorTopology';
import CANReplay from './CANReplay';
import AdaptiveSampleRate from './AdaptiveSampleRate';

const GATEWAY_API = 'http://localhost:8080';
const MAX_DATA_POINTS = 100;

function Dashboard() {
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [sensorData, setSensorData] = useState({ timestamps: [], temps: [], humidities: [] });
  const [alerts, setAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    fetchSensors();
    fetchAlerts();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSensor) {
      fetchSensorData(selectedSensor);
    }
  }, [selectedSensor]);

  const fetchSensors = async () => {
    try {
      const res = await fetch(`${GATEWAY_API}/api/sensors`);
      const data = await res.json();
      setSensors(data.sensors || []);
      if (data.sensors && data.sensors.length > 0) {
        setSelectedSensor(data.sensors[0]);
      }
    } catch (err) {
      console.error('Failed to fetch sensors:', err);
    }
  };

  const fetchSensorData = async (sensorId) => {
    try {
      const res = await fetch(`${GATEWAY_API}/api/sensors/${sensorId}/data?limit=${MAX_DATA_POINTS}`);
      const data = await res.json();
      
      const timestamps = [];
      const temps = [];
      const humidities = [];
      
      (data.data || []).forEach(d => {
        timestamps.push(new Date(d.timestamp).toLocaleTimeString());
        temps.push(d.temp);
        humidities.push(d.humidity);
      });
      
      setSensorData({ timestamps, temps, humidities });
    } catch (err) {
      console.error('Failed to fetch sensor data:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${GATEWAY_API}/api/alerts?limit=50`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const connectWebSocket = useCallback(() => {
    setConnectionStatus('connecting');
    const ws = new WebSocket(`ws://localhost:8080/api/ws`);
    
    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'sensor_data') {
        const data = msg.data;
        if (data.sensor_id === selectedSensor) {
          setSensorData(prev => {
            const newTimestamps = [...prev.timestamps, new Date(data.timestamp).toLocaleTimeString()];
            const newTemps = [...prev.temps, data.temp];
            const newHumidities = [...prev.humidities, data.humidity];
            
            if (newTimestamps.length > MAX_DATA_POINTS) {
              newTimestamps.shift();
              newTemps.shift();
              newHumidities.shift();
            }
            
            return { timestamps: newTimestamps, temps: newTemps, humidities: newHumidities };
          });
        }
      } else if (msg.type === 'alert') {
        setAlerts(prev => [msg.alert, ...prev].slice(0, 50));
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('WebSocket disconnected, retrying in 3s...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;
  }, [selectedSensor]);

  const getChartOption = () => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['Temperature (°C)', 'Humidity (%)'],
      textStyle: { color: '#aaa' },
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: sensorData.timestamps,
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Temperature (°C)',
        position: 'left',
        axisLine: { lineStyle: { color: '#00d4ff' } },
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#333' } }
      },
      {
        type: 'value',
        name: 'Humidity (%)',
        position: 'right',
        axisLine: { lineStyle: { color: '#ff6b6b' } },
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#333' } }
      }
    ],
    series: [
      {
        name: 'Temperature (°C)',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 0,
        data: sensorData.temps,
        lineStyle: { color: '#00d4ff', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 212, 255, 0)' }
            ]
          }
        }
      },
      {
        name: 'Humidity (%)',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 1,
        data: sensorData.humidities,
        lineStyle: { color: '#ff6b6b', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 107, 107, 0.3)' },
              { offset: 1, color: 'rgba(255, 107, 107, 0)' }
            ]
          }
        }
      }
    ]
  });

  const styles = {
    container: {
      minHeight: '100vh',
      padding: '20px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '20px',
      borderBottom: '1px solid #333'
    },
    title: {
      fontSize: '28px',
      fontWeight: 'bold',
      background: 'linear-gradient(90deg, #00d4ff, #ff6b6b)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    status: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '20px',
      backgroundColor: connectionStatus === 'connected' ? 'rgba(0, 255, 100, 0.2)' : 'rgba(255, 107, 107, 0.2)',
      color: connectionStatus === 'connected' ? '#0f0' : '#ff6b6b'
    },
    controls: {
      display: 'flex',
      gap: '20px',
      marginBottom: '20px',
      alignItems: 'center'
    },
    select: {
      padding: '10px 15px',
      backgroundColor: '#16213e',
      border: '1px solid #333',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '14px',
      minWidth: '200px'
    },
    main: {
      display: 'grid',
      gridTemplateColumns: '1fr 350px',
      gap: '20px'
    },
    chartContainer: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px'
    },
    alertContainer: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px',
      maxHeight: '600px',
      overflowY: 'auto'
    },
    alertTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '15px',
      color: '#ff6b6b'
    },
    alertItem: {
      padding: '12px',
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      borderRadius: '8px',
      marginBottom: '10px',
      borderLeft: '3px solid #ff6b6b'
    },
    alertSensor: {
      fontWeight: 'bold',
      fontSize: '14px',
      marginBottom: '4px'
    },
    alertMessage: {
      fontSize: '12px',
      color: '#aaa'
    },
    alertTime: {
      fontSize: '11px',
      color: '#666',
      marginTop: '4px'
    },
    stats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '15px',
      marginBottom: '20px'
    },
    statCard: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px',
      textAlign: 'center'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#00d4ff'
    },
    statLabel: {
      fontSize: '12px',
      color: '#888',
      marginTop: '5px'
    }
  };

  const handleSensorSelect = (sensorID) => {
    setSelectedSensor(sensorID);
    fetchSensorData(sensorID);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Edge Gateway Dashboard</h1>
        <div style={styles.status}>
          <span>●</span>
          <span>WebSocket: {connectionStatus}</span>
        </div>
      </div>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{sensors.length}</div>
          <div style={styles.statLabel}>Active Sensors</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{sensorData.temps.length}</div>
          <div style={styles.statLabel}>Data Points</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#ff6b6b'}}>{alerts.length}</div>
          <div style={styles.statLabel}>Total Alerts</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#0f0'}}>
            {sensorData.temps.length > 0 ? sensorData.temps[sensorData.temps.length - 1].toFixed(1) + '°C' : '-'}
          </div>
          <div style={styles.statLabel}>Current Temp</div>
        </div>
      </div>

      <CANReplay />

      <AdaptiveSampleRate />

      <SensorTopology onSensorSelect={handleSensorSelect} />

      <div style={styles.controls}>
        <label style={{color: '#aaa'}}>Select Sensor:</label>
        <select
          style={styles.select}
          value={selectedSensor}
          onChange={(e) => handleSensorSelect(e.target.value)}
        >
          {sensors.map(sensor => (
            <option key={sensor} value={sensor}>{sensor}</option>
          ))}
        </select>
      </div>

      <div style={styles.main}>
        <div style={styles.chartContainer}>
          <h3 style={{color: '#fff', marginBottom: '15px', fontSize: '16px'}}>
            📊 {selectedSensor} - 实时温湿度曲线
          </h3>
          <ReactECharts
            ref={chartRef}
            option={getChartOption()}
            style={{ height: '400px' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>

        <div style={styles.alertContainer}>
          <h2 style={styles.alertTitle}>⚠ Recent Alerts</h2>
          {alerts.length === 0 ? (
            <p style={{color: '#666', textAlign: 'center', padding: '20px'}}>No alerts yet</p>
          ) : (
            alerts.slice(0, 15).map((alert, idx) => (
              <div key={alert.id || idx} style={styles.alertItem}>
                <div style={styles.alertSensor}>{alert.sensor_id}</div>
                <div style={styles.alertMessage}>{alert.message}</div>
                <div style={styles.alertTime}>
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
