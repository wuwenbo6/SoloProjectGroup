import React from 'react';
import { useDeviceStore } from '../store/deviceStore';

function Header() {
  const { devices, stats } = useDeviceStore();
  const connected = devices.size > 0;
  const faultCount = Array.from(devices.values()).filter(d => d.faultCode > 0).length;

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <header className="header">
      <h1>🏭 3D工厂数字孪生平台</h1>
      <div className="status">
        <span>设备总数: {devices.size}</span>
        {faultCount > 0 && <span style={{ color: '#ff5252' }}>故障: {faultCount}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="status-dot" style={{ background: connected ? '#4caf50' : '#f44336' }}></span>
          {connected ? '已连接' : '断开连接'}
        </span>
        <span style={{ marginLeft: '16px', fontSize: '12px', opacity: 0.8 }}>
          📦 MsgPack 已节省: {formatBytes(stats.bytesSaved)}
        </span>
      </div>
    </header>
  );
}

export default Header;
