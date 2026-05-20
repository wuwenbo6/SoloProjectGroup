import React, { useState, useEffect } from 'react';
import { cameraAPI } from '../services/api';

interface Device {
  id: string;
  name: string;
  connection_type: string;
  port?: string;
  vendor_id?: string;
  product_id?: string;
}

const CameraConnection: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await cameraAPI.listDevices();
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('加载设备失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await cameraAPI.getStatus();
      setConnectedDevices(response.data.connected_devices || []);
    } catch (error) {
      console.error('加载状态失败:', error);
    }
  };

  const connectDevice = async (deviceId: string) => {
    try {
      await cameraAPI.connect(deviceId);
      await loadStatus();
    } catch (error: any) {
      alert('连接失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    try {
      await cameraAPI.disconnect(deviceId);
      await loadStatus();
    } catch (error: any) {
      alert('断开连接失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  useEffect(() => {
    loadDevices();
    loadStatus();
  }, []);

  const isConnected = (deviceId: string) => connectedDevices.includes(deviceId);

  return (
    <div>
      <h2 className="page-title">相机连接</h2>
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>检测到的设备</h3>
          <button className="btn btn-secondary" onClick={loadDevices} disabled={loading}>
            {loading ? '刷新中...' : '刷新设备'}
          </button>
        </div>

        {devices.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
            未检测到设备，请确保相机已通过USB或串口连接
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {devices.map(device => (
              <div
                key={device.id}
                className="card"
                style={{ 
                  margin: 0,
                  borderColor: isConnected(device.id) ? '#28a745' : '#0f3460'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4>{device.name}</h4>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>
                      类型: {device.connection_type === 'usb' ? 'USB' : '串口'}
                      {device.port && ` | 端口: ${device.port}`}
                      {device.vendor_id && ` | 厂商ID: ${device.vendor_id}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`status-badge ${isConnected(device.id) ? 'status-connected' : 'status-disconnected'}`}>
                      {isConnected(device.id) ? '已连接' : '未连接'}
                    </span>
                    {isConnected(device.id) ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => disconnectDevice(device.id)}
                      >
                        断开
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => connectDevice(device.id)}
                      >
                        连接
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>连接状态</h3>
        <div style={{ marginTop: '1rem' }}>
          <p>
            当前连接设备数: <strong>{connectedDevices.length}</strong>
          </p>
          {connectedDevices.length > 0 && (
            <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', color: '#28a745' }}>
              {connectedDevices.map(id => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3>使用说明</h3>
        <ul style={{ marginLeft: '1.5rem', marginTop: '1rem', lineHeight: '1.8' }}>
          <li>确保胶片相机已通过USB线缆或串口线正确连接到电脑</li>
          <li>点击"刷新设备"按钮检测可用设备</li>
          <li>选中对应设备后点击"连接"建立通信</li>
          <li>连接成功后可以在扫描转录页面进行扫描操作</li>
          <li>如果设备无法识别，请检查驱动程序和连接线缆</li>
        </ul>
      </div>
    </div>
  );
};

export default CameraConnection;
