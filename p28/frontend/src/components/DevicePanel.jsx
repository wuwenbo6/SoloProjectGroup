import React from 'react';
import { useDeviceStore } from '../store/deviceStore';
import DeviceDetail from './DeviceDetail';
import SandboxPanel from './SandboxPanel';

function DevicePanel() {
  const { devices, selectedDevice, selectDevice } = useDeviceStore();
  const deviceArray = Array.from(devices.values());

  const getDeviceTypeName = (type) => {
    const types = {
      conveyor: '传送带',
      robot_arm: '机械臂',
      agv: 'AGV小车'
    };
    return types[type] || type;
  };

  const getDeviceStatusClass = (device) => {
    if (device.faultCode > 0) return 'fault';
    if (!device.running) return 'stopped';
    return '';
  };

  return (
    <aside className="sidebar">
      <SandboxPanel />

      <div className="device-panel">
        <h2>📋 设备列表</h2>
        {deviceArray.map((device) => (
          <div
            key={device.id}
            className={`device-item ${getDeviceStatusClass(device)} ${selectedDevice === device.id ? 'selected' : ''}`}
            onClick={() => selectDevice(device.id)}
          >
            <h3>{device.name}</h3>
            <div className="device-type">{getDeviceTypeName(device.type)}</div>
            <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>温度: {device.temperature?.toFixed(1) || '--'}°C</span>
              <span style={{ color: device.running ? '#4caf50' : '#ff9800' }}>
                {device.running ? '运行中' : '已停止'}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {selectedDevice && <DeviceDetail deviceId={selectedDevice} />}
    </aside>
  );
}

export default DevicePanel;
