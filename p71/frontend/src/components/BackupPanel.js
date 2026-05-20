import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Trash2, Download, Cloud, CheckCircle } from 'lucide-react';

const BackupPanel = ({ devices, api }) => {
  const [backups, setBackups] = useState([]);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/backups?limit=20');
      setBackups(res.data);
    } catch (e) {
      console.error('Failed to fetch backups:', e);
    }
  };

  const createBackup = async () => {
    if (devices.length === 0) return;
    setCreating(true);
    try {
      const device = devices[0];
      const paramsRes = await api.get(`/devices/${device.id}/parameters`);
      const configData = {
        device_info: {
          name: device.name,
          device_type: device.device_type,
          ip_address: device.ip_address,
        },
        parameters: Object.fromEntries(paramsRes.data.map(p => [p.key, p.value])),
        backup_time: new Date().toISOString(),
      };

      await api.post('/backups', {
        backup_name: `手动备份_${new Date().toLocaleString('zh-CN')}`,
        device_id: device.id,
        backup_type: 'manual',
        description: '用户手动创建的备份',
        is_auto_restore: false,
        config_data: configData,
      });
      await fetchBackups();
    } catch (e) {
      console.error('Failed to create backup:', e);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId) => {
    setRestoring(backupId);
    try {
      await api.post(`/backups/${backupId}/restore`);
    } catch (e) {
      console.error('Failed to restore backup:', e);
    } finally {
      setRestoring(null);
    }
  };

  const deleteBackup = async (backupId) => {
    try {
      await api.delete(`/backups/${backupId}`);
      await fetchBackups();
    } catch (e) {
      console.error('Failed to delete backup:', e);
    }
  };

  const getBackupTypeStyle = (type) => {
    if (type === 'auto') {
      return { background: 'rgba(255, 152, 0, 0.2)', color: '#ffb74d', label: '自动' };
    }
    return { background: 'rgba(33, 150, 243, 0.2)', color: '#90caf9', label: '手动' };
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>参数备份管理</h3>
        <button
          onClick={createBackup}
          disabled={creating || devices.length === 0}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #4caf50, #388e3c)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: devices.length ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {creating ? <Download size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
          创建备份
        </button>
      </div>

      {backups.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <Cloud size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>暂无备份记录</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>系统会每小时自动备份设备参数</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
          {backups.map(backup => {
            const typeStyle = getBackupTypeStyle(backup.backup_type);
            return (
              <div
                key={backup.id}
                style={{
                  padding: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{backup.backup_name}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: 600,
                      ...typeStyle,
                    }}>{typeStyle.label}</span>
                    {backup.is_auto_restore && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(76, 175, 80, 0.2)',
                        color: '#81c784',
                      }}>自动恢复</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(backup.created_at).toLocaleString('zh-CN')}
                    {backup.description && ` · ${backup.description}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => restoreBackup(backup.id)}
                    disabled={restoring === backup.id}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(33, 150, 243, 0.2)',
                      border: '1px solid rgba(33, 150, 243, 0.4)',
                      borderRadius: '6px',
                      color: '#90caf9',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {restoring === backup.id ? (
                      <Download size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    恢复
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.id)}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(244, 67, 54, 0.2)',
                      border: '1px solid rgba(244, 67, 54, 0.4)',
                      borderRadius: '6px',
                      color: '#e57373',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                    }}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(76, 175, 80, 0.1)',
        borderRadius: '10px',
        border: '1px solid rgba(76, 175, 80, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <CheckCircle size={18} color="#81c784" />
          <span style={{ fontWeight: 500, color: '#81c784' }}>云端同步已启用</span>
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          系统每小时自动备份所有设备配置，数据安全存储。设备故障时可一键恢复参数设置。
        </p>
      </div>
    </div>
  );
};

export default BackupPanel;
