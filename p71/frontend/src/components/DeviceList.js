import React from 'react';
import { Monitor, Wifi, WifiOff } from 'lucide-react';

const DeviceList = ({ devices }) => {
  const getStatusClass = (status, isConnected) => {
    if (!isConnected) return 'offline';
    if (status === 'running') return 'running';
    return 'online';
  };

  const getStatusText = (status, isConnected) => {
    if (!isConnected) return '离线';
    if (status === 'running') return '运行中';
    return '在线';
  };

  return (
    <div className="device-list">
      {devices.map((device) => (
        <div key={device.id} className="device-item">
          <div className="device-info">
            <div className="device-icon">
              <Monitor size={24} color="white" />
            </div>
            <div className="device-details">
              <h3>{device.name}</h3>
              <p>{device.ip_address || '未配置IP'}</p>
            </div>
          </div>
          <div className={`device-status ${getStatusClass(device.status, device.is_connected)}`}>
            {device.is_connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {getStatusText(device.status, device.is_connected)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceList;