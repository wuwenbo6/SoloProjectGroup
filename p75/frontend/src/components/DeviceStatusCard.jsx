import React from 'react';
import { Circle, Wifi, WifiOff, Activity } from 'lucide-react';

const DeviceStatusCard = ({ device, onConnect, onDisconnect, onStartCollect, onStopCollect }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'text-success';
      case 'collecting':
        return 'text-primary';
      case 'offline':
      default:
        return 'text-danger';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'online':
        return 'bg-success/10';
      case 'collecting':
        return 'bg-primary/10';
      case 'offline':
      default:
        return 'bg-danger/10';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'collecting':
        return '采集中';
      case 'offline':
        return '离线';
      default:
        return '未知';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusBg(device.status)}`}>
            <Activity className={`w-5 h-5 ${getStatusColor(device.status)}`} />
          </div>
          <div>
            <h3 className="font-semibold text-dark">{device.name}</h3>
            <p className="text-sm text-dark-2">ID: {device.device_id}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${getStatusColor(device.status)}`}>
          <Circle className={`w-3 h-3 fill-current ${device.is_connected ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium">{getStatusText(device.status)}</span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-dark-2">连接状态</span>
          <span className="flex items-center gap-1">
            {device.is_connected ? (
              <><Wifi className="w-4 h-4 text-success" /> 已连接</>
            ) : (
              <><WifiOff className="w-4 h-4 text-danger" /> 未连接</>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dark-2">最后心跳</span>
          <span>{device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString('zh-CN') : '无'}</span>
        </div>
        {device.config && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-dark-2">采样率</span>
              <span>{device.config.sample_rate} Hz</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-2">置信度阈值</span>
              <span>{(device.config.confidence_threshold * 100).toFixed(0)}%</span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!device.is_connected ? (
          <button
            onClick={() => onConnect(device.device_id)}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            连接设备
          </button>
        ) : (
          <button
            onClick={() => onDisconnect(device.device_id)}
            className="px-4 py-2 bg-gray-100 text-dark-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            断开连接
          </button>
        )}
        
        {device.is_connected && device.status !== 'collecting' && (
          <button
            onClick={() => onStartCollect(device.device_id)}
            className="flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors text-sm font-medium"
          >
            开始采集
          </button>
        )}
        
        {device.status === 'collecting' && (
          <button
            onClick={() => onStopCollect(device.device_id)}
            className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors text-sm font-medium"
          >
            停止采集
          </button>
        )}
      </div>
    </div>
  );
};

export default DeviceStatusCard;