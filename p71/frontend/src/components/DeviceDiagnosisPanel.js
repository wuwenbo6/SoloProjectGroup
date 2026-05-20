import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, AlertTriangle, Play } from 'lucide-react';

const DeviceDiagnosisPanel = ({ devices, api }) => {
  const [diagnosing, setDiagnosing] = useState(null);
  const [diagnoses, setDiagnoses] = useState({});

  useEffect(() => {
    devices.forEach(device => {
      fetchDiagnoses(device.id);
    });
  }, [devices]);

  const fetchDiagnoses = async (deviceId) => {
    try {
      const res = await api.get(`/devices/${deviceId}/diagnoses?limit=5`);
      setDiagnoses(prev => ({ ...prev, [deviceId]: res.data }));
    } catch (e) {
      console.error('Failed to fetch diagnoses:', e);
    }
  };

  const runDiagnosis = async (deviceId, autoRestart = false) => {
    setDiagnosing(deviceId);
    try {
      const res = await api.post(`/devices/${deviceId}/diagnose?is_auto_restart=${autoRestart}`);
      await fetchDiagnoses(deviceId);
    } catch (e) {
      console.error('Diagnosis failed:', e);
    } finally {
      setDiagnosing(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'running': return '#2196f3';
      default: return '#ff9800';
    }
  };

  const getResultSummary = (results) => {
    if (!results) return '暂无数据';
    const checks = [
      { name: '连接性', status: results.connectivity?.status },
      { name: '硬件状态', status: results.hardware?.status },
      { name: '参数校验', status: results.parameters?.status },
      { name: '网络状态', status: results.network?.status },
    ];
    const passed = checks.filter(c => c.status === 'passed').length;
    return `${passed}/${checks.length} 项通过`;
  };

  return (
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>设备诊断与维护</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {devices.map(device => (
          <div
            key={device.id}
            style={{
              padding: '16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #42a5f5, #1e88e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Activity size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{device.name}</div>
                  <div style={{ fontSize: '12px', color: device.is_connected ? '#81c784' : '#e57373' }}>
                    {device.is_connected ? '在线' : '离线'} | 失败次数: {device.failure_count || 0}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => runDiagnosis(device.id, false)}
                  disabled={diagnosing === device.id || !device.is_connected}
                  style={{
                    padding: '8px 12px',
                    background: diagnosing === device.id ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.2)',
                    border: '1px solid rgba(33, 150, 243, 0.5)',
                    borderRadius: '6px',
                    color: '#90caf9',
                    cursor: device.is_connected ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                  }}
                >
                  {diagnosing === device.id ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
                  诊断
                </button>
                <button
                  onClick={() => runDiagnosis(device.id, true)}
                  disabled={diagnosing === device.id || !device.is_connected}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(76, 175, 80, 0.2)',
                    border: '1px solid rgba(76, 175, 80, 0.5)',
                    borderRadius: '6px',
                    color: '#81c784',
                    cursor: device.is_connected ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                  }}
                >
                  <RefreshCw size={14} />
                  诊断并修复
                </button>
              </div>
            </div>

            {diagnoses[device.id] && diagnoses[device.id].length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>最近诊断记录</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {diagnoses[device.id].slice(0, 3).map(d => (
                    <div
                      key={d.id}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {d.results?.restart_performed ? (
                          <RefreshCw size={14} color="#4caf50" />
                        ) : (
                          <CheckCircle size={14} color="#4caf50" />
                        )}
                        <span>{new Date(d.started_at).toLocaleString('zh-CN')}</span>
                        <span style={{ color: getStatusColor(d.status) }}>{getResultSummary(d.results)}</span>
                        {d.is_auto_restart && (
                          <span style={{
                            background: 'rgba(76, 175, 80, 0.2)',
                            color: '#81c784',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                          }}>自动修复</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeviceDiagnosisPanel;
