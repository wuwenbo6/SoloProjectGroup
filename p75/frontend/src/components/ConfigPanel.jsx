import React, { useState } from 'react';
import { Settings, Save, Plus } from 'lucide-react';
import { deviceAPI } from '../services/api';

const ConfigPanel = ({ selectedDevice, onDeviceAdded, onConfigUpdated }) => {
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  
  const [config, setConfig] = useState({
    sample_rate: selectedDevice?.config?.sample_rate || 100,
    confidence_threshold: selectedDevice?.config?.confidence_threshold || 0.8,
    auto_save: selectedDevice?.config?.auto_save || true,
  });

  const handleAddDevice = async () => {
    if (!newDeviceId || !newDeviceName) return;
    try {
      await deviceAPI.register({ device_id: newDeviceId, name: newDeviceName });
      setNewDeviceId('');
      setNewDeviceName('');
      setShowAddDevice(false);
      onDeviceAdded();
    } catch (error) {
      console.error('Failed to add device:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedDevice) return;
    try {
      await deviceAPI.updateConfig(selectedDevice.device_id, config);
      onConfigUpdated();
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-dark-2" />
          <h2 className="text-lg font-semibold text-dark">设备配置</h2>
        </div>
        <button
          onClick={() => setShowAddDevice(!showAddDevice)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          添加设备
        </button>
      </div>

      {showAddDevice && (
        <div className="mb-4 p-4 bg-light-bg rounded-lg">
          <h3 className="font-medium text-dark mb-3">添加新设备</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-dark-2 mb-1">设备ID</label>
              <input
                type="text"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                placeholder="例如: TYPE-001"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-2 mb-1">设备名称</label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                placeholder="例如: 打字机一号"
              />
            </div>
            <button
              onClick={handleAddDevice}
              className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      {selectedDevice ? (
        <div className="space-y-4">
          <div className="p-3 bg-primary/5 rounded-lg">
            <p className="text-sm font-medium text-dark">{selectedDevice.name}</p>
            <p className="text-xs text-dark-2">ID: {selectedDevice.device_id}</p>
          </div>

          <div>
            <label className="block text-sm text-dark-2 mb-1">采样率 (Hz)</label>
            <input
              type="number"
              value={config.sample_rate}
              onChange={(e) => setConfig({ ...config, sample_rate: parseInt(e.target.value) || 100 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              min="1"
              max="1000"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-2 mb-1">
              置信度阈值: {(config.confidence_threshold * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              value={config.confidence_threshold}
              onChange={(e) => setConfig({ ...config, confidence_threshold: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              min="0"
              max="1"
              step="0.05"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-dark-2">自动保存</label>
            <button
              onClick={() => setConfig({ ...config, auto_save: !config.auto_save })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.auto_save ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.auto_save ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleSaveConfig}
            className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            保存配置
          </button>
        </div>
      ) : (
        <div className="text-center py-6 text-dark-2">
          <Settings className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">请选择一个设备进行配置</p>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;