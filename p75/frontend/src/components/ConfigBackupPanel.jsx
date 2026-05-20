import React, { useState, useEffect } from 'react';
import { Save, Download, Trash2, Clock, User, Check, Settings, UploadCloud } from 'lucide-react';
import { configAPI } from '../services/api';

const ConfigBackupPanel = ({ selectedDevice, onConfigRestored }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(null);

  const fetchBackups = async () => {
    if (!selectedDevice) return;
    
    try {
      const response = await configAPI.getBackups(selectedDevice.device_id);
      setBackups(response.data);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [selectedDevice]);

  const handleCreateBackup = async () => {
    if (!selectedDevice) return;
    
    setLoading(true);
    try {
      await configAPI.createBackup(selectedDevice.device_id, backupName || 'default');
      setBackupName('');
      fetchBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    try {
      await configAPI.restoreBackup(backupId);
      setShowRestoreConfirm(null);
      fetchBackups();
      if (onConfigRestored) onConfigRestored();
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    try {
      await configAPI.deleteBackup(backupId);
      fetchBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const exportConfig = (backup) => {
    const data = {
      version: backup.version,
      name: backup.config_name,
      config: backup.config_data,
      exportTime: new Date().toISOString(),
      deviceId: backup.device_id
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_${backup.config_name}_v${backup.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        console.log('Imported config:', config);
        // Here you would typically apply the config to the device
        alert('配置文件已加载，请点击"创建备份"保存到设备');
        if (config.config && config.config.sample_rate) {
          setBackupName(`导入_${config.name || 'config'}`);
        }
      } catch (error) {
        alert('无效的配置文件格式');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };

  if (!selectedDevice) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">配置备份管理</h2>
        <div className="text-center py-8 text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">请先选择设备</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">配置备份管理</h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
        <input
          type="text"
          value={backupName}
          onChange={(e) => setBackupName(e.target.value)}
          placeholder="备份名称 (可选)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          创建备份
        </button>
        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors cursor-pointer">
          <UploadCloud className="w-4 h-4" />
          导入配置
          <input
            type="file"
            accept=".json"
            onChange={handleImportConfig}
            className="hidden"
          />
        </label>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-auto">
        {backups.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Save className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无备份记录</p>
            <p className="text-xs mt-1">点击"创建备份"保存当前配置</p>
          </div>
        ) : (
          backups.map((backup) => (
            <div
              key={backup.id}
              className={`p-4 rounded-xl border ${
                backup.is_active
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    backup.is_active ? 'bg-primary/10' : 'bg-gray-100'
                  }`}>
                    <Save className={`w-4 h-4 ${
                      backup.is_active ? 'text-primary' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800">{backup.config_name}</h3>
                      <span className="text-xs text-gray-500">v{backup.version}</span>
                      {backup.is_active && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                          <Check className="w-3 h-3" />
                          当前版本
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(backup.created_at).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {backup.created_by}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportConfig(backup)}
                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                    title="导出配置"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  
                  {!backup.is_active && (
                    showRestoreConfirm === backup.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRestoreBackup(backup.id)}
                          className="px-2 py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setShowRestoreConfirm(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowRestoreConfirm(backup.id)}
                          className="p-1.5 text-gray-500 hover:text-success hover:bg-gray-100 rounded-lg transition-colors"
                          title="恢复此配置"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="p-1.5 text-gray-500 hover:text-danger hover:bg-gray-100 rounded-lg transition-colors"
                          title="删除备份"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>

              {backup.config_data && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-gray-500">采样率</span>
                      <p className="font-medium text-gray-700">{backup.config_data.sample_rate} Hz</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-gray-500">置信度阈值</span>
                      <p className="font-medium text-gray-700">{(backup.config_data.confidence_threshold * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-gray-500">自动保存</span>
                      <p className="font-medium text-gray-700">{backup.config_data.auto_save ? '开启' : '关闭'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConfigBackupPanel;