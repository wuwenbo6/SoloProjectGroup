import React from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function DeviceDetail({ deviceId }) {
  const { devices, historyData, sendControlCommand } = useDeviceStore();
  const device = devices.get(deviceId);
  const history = historyData[deviceId] || [];

  if (!device) return null;

  const getFaultDescription = (code) => {
    const faults = {
      0: '无故障',
      1: '电机过载',
      2: '传感器异常',
      3: '通信故障',
      4: '紧急停止'
    };
    return faults[code] || `未知故障 (${code})`;
  };

  const formatChartData = () => {
    return history.slice(-20).map((item, index) => ({
      name: index,
      temperature: item.temperature?.toFixed(1),
      speed: item.speed?.toFixed(2) || item.rotationSpeed?.toFixed(2) || 0
    }));
  };

  return (
    <div className="device-detail">
      <h3>🔧 {device.name} - 详情</h3>
      
      <div className="status-grid">
        <div className="status-item">
          <div className="label">温度</div>
          <div className="value">
            {device.temperature?.toFixed(1) || '--'}
            <span className="unit">°C</span>
          </div>
        </div>
        
        {device.speed !== undefined && (
          <div className="status-item">
            <div className="label">速度</div>
            <div className="value">
              {device.speed?.toFixed(2) || '--'}
              <span className="unit">m/s</span>
            </div>
          </div>
        )}
        
        {device.rotationSpeed !== undefined && (
          <div className="status-item">
            <div className="label">转速</div>
            <div className="value">
              {device.rotationSpeed?.toFixed(1) || '--'}
              <span className="unit">°/s</span>
            </div>
          </div>
        )}
        
        {device.battery !== undefined && (
          <div className="status-item">
            <div className="label">电池</div>
            <div className="value">
              {device.battery?.toFixed(1) || '--'}
              <span className="unit">%</span>
            </div>
          </div>
        )}
        
        <div className="status-item">
          <div className="label">运行状态</div>
          <div className="value" style={{ color: device.running ? '#4caf50' : '#ff9800' }}>
            {device.running ? '运行中' : '已停止'}
          </div>
        </div>
        
        <div className="status-item">
          <div className="label">故障状态</div>
          <div className="value" style={{ color: device.faultCode > 0 ? '#f44336' : '#4caf50' }}>
            {getFaultDescription(device.faultCode)}
          </div>
        </div>
      </div>

      <div className="control-buttons">
        <button 
          className="btn-start" 
          onClick={() => sendControlCommand(deviceId, 'start')}
          disabled={device.running}
        >
          ▶ 启动
        </button>
        <button 
          className="btn-stop" 
          onClick={() => sendControlCommand(deviceId, 'stop')}
          disabled={!device.running}
        >
          ⏹ 停止
        </button>
      </div>

      {history.length > 0 && (
        <div className="chart-container">
          <h4>📈 温度历史趋势</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={formatChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#f44336" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="legend">
            <div className="legend-item">
              <span className="legend-color" style={{ background: '#f44336' }}></span>
              温度 (°C)
            </div>
            {device.speed !== undefined && (
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#2196f3' }}></span>
                速度 (m/s)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceDetail;
