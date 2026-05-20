import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertTriangle, CheckCircle, Heart, Zap, Clock, RotateCcw } from 'lucide-react';
import { diagnosticAPI } from '../services/api';

const DeviceDiagnosticPanel = ({ selectedDevice, onRefresh }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const fetchDiagnostics = async () => {
    if (!selectedDevice) return;
    
    setLoading(true);
    try {
      const response = await diagnosticAPI.getDeviceDiagnostics(selectedDevice.device_id);
      setDiagnostics(response.data);
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, [selectedDevice]);

  const handleRestart = async () => {
    if (!selectedDevice) return;
    
    setRestarting(true);
    try {
      await diagnosticAPI.restartDevice(selectedDevice.device_id);
      await new Promise(resolve => setTimeout(resolve, 2000));
      fetchDiagnostics();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to restart device:', error);
    } finally {
      setRestarting(false);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-danger';
      default: return 'text-gray-400';
    }
  };

  const getHealthBg = (status) => {
    switch (status) {
      case 'healthy': return 'bg-success/10';
      case 'warning': return 'bg-warning/10';
      case 'critical': return 'bg-danger/10';
      default: return 'bg-gray-100';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-danger" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCheckIcon = (type) => {
    const icons = {
      heartbeat_failure: <Heart className="w-4 h-4" />,
      high_error_rate: <Activity className="w-4 h-4" />,
      low_confidence: <Zap className="w-4 h-4" />,
      connection_unstable: <RefreshCw className="w-4 h-4" />,
    };
    return icons[type] || <Activity className="w-4 h-4" />;
  };

  const getCheckName = (type) => {
    const names = {
      heartbeat_failure: '心跳检测',
      high_error_rate: '错误率检测',
      low_confidence: '置信度检测',
      connection_unstable: '连接稳定性检测',
    };
    return names[type] || type;
  };

  if (!selectedDevice) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">设备健康诊断</h2>
        <div className="text-center py-8 text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">请先选择设备</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">设备健康诊断</h2>
          {diagnostics && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getHealthBg(diagnostics.overall_health)} ${getHealthColor(diagnostics.overall_health)}`}>
              {diagnostics.overall_health === 'healthy' ? '健康' : 
               diagnostics.overall_health === 'warning' ? '需注意' : '异常'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
            {restarting ? '重启中...' : '重启设备'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">正在诊断...</span>
        </div>
      ) : diagnostics ? (
        <>
          <div className="space-y-3 mb-6">
            {Object.entries(diagnostics.current_status).map(([key, check]) => (
              <div key={key} className={`p-4 rounded-xl border ${getHealthBg(check.status)} border-gray-100">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white shadow-sm">
                    {getCheckIcon(key)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-800">{getCheckName(key)}</h3>
                      {getHealthIcon(check.status)}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{check.message}</p>
                    {check.resolution && (
                      <p className="text-xs text-primary mt-1">建议: {check.resolution}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {diagnostics.history && diagnostics.history.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">诊断历史</h3>
              <div className="space-y-2 max-h-48 overflow-auto">
                {diagnostics.history.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {item.type === 'manual_restart' ? '手动重启' : item.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                      }`}>
                        {item.status === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{item.message}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default DeviceDiagnosticPanel;