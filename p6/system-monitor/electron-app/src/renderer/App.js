const { useState, useEffect, useCallback } = React;
const { ipcRenderer } = require('electron');

function App() {
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [processFilter, setProcessFilter] = useState('');
  const [retentionDays, setRetentionDays] = useState(7);
  const [exportStartTime, setExportStartTime] = useState('');
  const [exportEndTime, setExportEndTime] = useState('');
  const [updateKey, setUpdateKey] = useState(0);

  const [alertConfig, setAlertConfig] = useState({
    cpuThreshold: 90,
    memoryThreshold: 90,
    diskThreshold: 90,
    notificationType: 'both',
    enabled: true
  });
  const [alerts, setAlerts] = useState([]);
  const [showAlertPanel, setShowAlertPanel] = useState(false);

  const [selectedProcess, setSelectedProcess] = useState(null);
  const [processDetail, setProcessDetail] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processSearchTerm, setProcessSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleMetricsUpdate = useCallback((event, data) => {
    setCurrentMetrics(data);
    setMetricsHistory(prev => {
      const newHistory = [...prev, data];
      if (newHistory.length > 60) {
        newHistory.shift();
      }
      return newHistory;
    });
    setUpdateKey(prev => prev + 1);
  }, []);

  const handleAlertTriggered = useCallback((event, alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    ipcRenderer.on('metrics-update', handleMetricsUpdate);
    ipcRenderer.on('alert-triggered', handleAlertTriggered);
    
    ipcRenderer.invoke('get-alert-config').then(config => {
      setAlertConfig(config);
    });
    
    return () => {
      ipcRenderer.removeListener('metrics-update', handleMetricsUpdate);
      ipcRenderer.removeListener('alert-triggered', handleAlertTriggered);
    };
  }, [handleMetricsUpdate, handleAlertTriggered]);

  const handleRefreshIntervalChange = (interval) => {
    setRefreshInterval(interval);
    ipcRenderer.send('set-refresh-interval', interval);
  };

  const handleProcessFilterChange = (filter) => {
    setProcessFilter(filter);
    ipcRenderer.send('set-process-filter', filter || null);
  };

  const handleRetentionDaysChange = (days) => {
    setRetentionDays(days);
    ipcRenderer.send('set-retention-days', days);
  };

  const handleCleanupData = async () => {
    const result = await ipcRenderer.invoke('cleanup-old-data');
    alert(`清理完成：删除了 ${result.systemDeleted} 条系统数据和 ${result.processDeleted} 条进程数据`);
  };

  const handleExportReport = async (type) => {
    if (!exportStartTime || !exportEndTime) {
      alert('请选择开始和结束时间');
      return;
    }
    const startTime = new Date(exportStartTime).getTime();
    const endTime = new Date(exportEndTime).getTime();
    const result = await ipcRenderer.invoke('export-report', type, startTime, endTime, processFilter);
    if (result) {
      alert(`报告已导出：${result.path} (${result.recordCount} 条记录)`);
    }
  };

  const handleAlertConfigChange = async (key, value) => {
    const newConfig = { ...alertConfig, [key]: value };
    setAlertConfig(newConfig);
    await ipcRenderer.invoke('set-alert-config', newConfig);
  };

  const handleViewProcessDetail = async (pid) => {
    const detail = await ipcRenderer.invoke('get-process-detail', pid);
    if (!detail.error) {
      setProcessDetail(detail);
      setShowProcessModal(true);
    } else {
      alert('获取进程详情失败：' + detail.error);
    }
  };

  const handleKillProcess = async (pid) => {
    if (!confirm(`确定要结束 PID 为 ${pid} 的进程吗？此操作不可撤销！`)) {
      return;
    }
    const result = await ipcRenderer.invoke('kill-process', pid);
    if (result.success) {
      alert('进程已成功结束');
      setShowProcessModal(false);
      setSelectedProcess(null);
    } else {
      alert('结束进程失败：' + result.error);
    }
  };

  const handleSearchProcesses = async () => {
    if (!processSearchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await ipcRenderer.invoke('search-processes', processSearchTerm);
    if (!results.error) {
      setSearchResults(results);
    }
  };

  const getBarColor = (value) => {
    if (value < 50) return '#4ade80';
    if (value < 80) return '#fbbf24';
    return '#ef4444';
  };

  const formatBytes = (bytes) => {
    const mb = bytes / 1024 / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const formatRate = (bytesPerSec) => {
    const mbPerSec = bytesPerSec / 1024 / 1024;
    return `${mbPerSec.toFixed(2)} MB/s`;
  };

  const getAlertTypeName = (type) => {
    const names = { cpu: 'CPU 使用率', memory: '内存使用率', disk: '磁盘使用率' };
    return names[type] || type;
  };

  const getNotificationTypeName = (type) => {
    const names = { dialog: '弹窗通知', notification: '系统通知', both: '双重通知' };
    return names[type] || type;
  };

  if (!currentMetrics) {
    return React.createElement('div', { 
      style: { padding: '50px', textAlign: 'center', fontSize: '20px', color: '#eee' } 
    }, '正在加载数据...');
  }

  const CpuChart = window.CpuChart;
  const MemoryChart = window.MemoryChart;
  const DiskChart = window.DiskChart;
  const NetworkChart = window.NetworkChart;

  return React.createElement('div', { key: 'app-root' },
    React.createElement('style', null, `
      .alert-badge {
        background: #ef4444;
        color: white;
        border-radius: 10px;
        padding: 2px 8px;
        font-size: 12px;
        margin-left: 8px;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: #1a1a2e;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 1px solid #333;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #333;
      }
      .close-btn {
        background: none;
        border: none;
        color: #888;
        font-size: 24px;
        cursor: pointer;
      }
      .detail-row {
        display: flex;
        padding: 12px 0;
        border-bottom: 1px solid #222;
      }
      .detail-label {
        width: 120px;
        color: #888;
        flex-shrink: 0;
      }
      .detail-value {
        color: #eee;
        flex: 1;
        word-break: break-all;
      }
      .action-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        margin-right: 8px;
      }
      .action-btn.danger {
        background: #ef4444;
        color: white;
      }
      .action-btn.primary {
        background: #4a6fa5;
        color: white;
      }
      .process-row:hover {
        background: rgba(74, 111, 165, 0.2) !important;
        cursor: pointer;
      }
      .search-box {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      .alert-item {
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid #ef4444;
        margin-bottom: 8px;
        border-radius: 4px;
      }
      .alert-time {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
      }
      .config-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #222;
      }
      .config-input {
        width: 80px;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #444;
        background: #2a2a4e;
        color: #eee;
      }
      .toggle-switch {
        position: relative;
        width: 48px;
        height: 24px;
      }
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #444;
        transition: .4s;
        border-radius: 24px;
      }
      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      input:checked + .toggle-slider {
        background-color: #4ade80;
      }
      input:checked + .toggle-slider:before {
        transform: translateX(24px);
      }
    `),

    React.createElement('div', { className: 'header' },
      React.createElement('h1', null, '🖥️ 系统资源监控'),
      React.createElement('div', { className: 'controls' },
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, '刷新频率:'),
          React.createElement('select', {
            value: refreshInterval,
            onChange: (e) => handleRefreshIntervalChange(Number(e.target.value))
          },
            React.createElement('option', { value: 1000 }, '1秒'),
            React.createElement('option', { value: 5000 }, '5秒'),
            React.createElement('option', { value: 10000 }, '10秒')
          )
        ),
        React.createElement('button', {
          className: 'action-btn primary',
          onClick: () => setShowAlertPanel(!showAlertPanel)
        }, '⚙️ 告警配置',
          alerts.length > 0 && React.createElement('span', { className: 'alert-badge' }, alerts.length)
        )
      )
    ),

    showAlertPanel && React.createElement('div', { className: 'export-section' },
      React.createElement('div', { className: 'chart-title' }, '⚠️ 告警配置'),
      React.createElement('div', { className: 'config-row' },
        React.createElement('span', null, '启用告警'),
        React.createElement('label', { className: 'toggle-switch' },
          React.createElement('input', {
            type: 'checkbox',
            checked: alertConfig.enabled,
            onChange: (e) => handleAlertConfigChange('enabled', e.target.checked)
          }),
          React.createElement('span', { className: 'toggle-slider' })
        )
      ),
      React.createElement('div', { className: 'config-row' },
        React.createElement('span', null, 'CPU 告警阈值 (%)'),
        React.createElement('input', {
          type: 'number',
          className: 'config-input',
          min: 1,
          max: 100,
          value: alertConfig.cpuThreshold,
          onChange: (e) => handleAlertConfigChange('cpuThreshold', Number(e.target.value))
        })
      ),
      React.createElement('div', { className: 'config-row' },
        React.createElement('span', null, '内存告警阈值 (%)'),
        React.createElement('input', {
          type: 'number',
          className: 'config-input',
          min: 1,
          max: 100,
          value: alertConfig.memoryThreshold,
          onChange: (e) => handleAlertConfigChange('memoryThreshold', Number(e.target.value))
        })
      ),
      React.createElement('div', { className: 'config-row' },
        React.createElement('span', null, '磁盘告警阈值 (%)'),
        React.createElement('input', {
          type: 'number',
          className: 'config-input',
          min: 1,
          max: 100,
          value: alertConfig.diskThreshold,
          onChange: (e) => handleAlertConfigChange('diskThreshold', Number(e.target.value))
        })
      ),
      React.createElement('div', { className: 'config-row' },
        React.createElement('span', null, '通知方式'),
        React.createElement('select', {
          style: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #444', background: '#2a2a4e', color: '#eee' },
          value: alertConfig.notificationType,
          onChange: (e) => handleAlertConfigChange('notificationType', e.target.value)
        },
          React.createElement('option', { value: 'dialog' }, '弹窗通知'),
          React.createElement('option', { value: 'notification' }, '系统通知'),
          React.createElement('option', { value: 'both' }, '双重通知')
        )
      ),
      alerts.length > 0 && React.createElement('div', null,
        React.createElement('h4', { style: { marginTop: '20px', marginBottom: '10px' } }, '最近告警记录'),
        alerts.slice(0, 5).map((alert, index) => (
          React.createElement('div', { className: 'alert-item', key: index },
            React.createElement('div', null, '⚠️ ', getAlertTypeName(alert.type), 
              ' 超过阈值: ', alert.value.toFixed(1), '% >= ', alert.threshold, '%'),
            React.createElement('div', { className: 'alert-time' },
              new Date(alert.timestamp).toLocaleString()
            )
          )
        ))
      )
    ),

    React.createElement('div', { className: 'metrics-grid' },
      React.createElement('div', { className: 'metric-card' },
        React.createElement('div', { className: 'metric-title' }, 'CPU 使用率'),
        React.createElement('div', { 
          className: 'metric-value', 
          style: { color: getBarColor(currentMetrics.cpuUsage) }
        }, currentMetrics.cpuUsage.toFixed(1) + '%'),
        React.createElement('div', { className: 'metric-bar' },
          React.createElement('div', {
            className: 'metric-bar-fill',
            style: {
              width: `${currentMetrics.cpuUsage}%`,
              background: getBarColor(currentMetrics.cpuUsage)
            }
          })
        )
      ),

      React.createElement('div', { className: 'metric-card' },
        React.createElement('div', { className: 'metric-title' }, '内存使用率'),
        React.createElement('div', {
          className: 'metric-value',
          style: { color: getBarColor(currentMetrics.memoryUsage) }
        }, currentMetrics.memoryUsage.toFixed(1) + '%'),
        React.createElement('div', { className: 'metric-bar' },
          React.createElement('div', {
            className: 'metric-bar-fill',
            style: {
              width: `${currentMetrics.memoryUsage}%`,
              background: getBarColor(currentMetrics.memoryUsage)
            }
          })
        ),
        React.createElement('div', { style: { marginTop: '8px', fontSize: '12px', color: '#888' } },
          formatBytes(currentMetrics.memoryUsed), ' / ', formatBytes(currentMetrics.memoryTotal)
        )
      ),

      React.createElement('div', { className: 'metric-card' },
        React.createElement('div', { className: 'metric-title' }, '磁盘使用率'),
        React.createElement('div', {
          className: 'metric-value',
          style: { color: getBarColor(currentMetrics.diskUsage) }
        }, currentMetrics.diskUsage.toFixed(1) + '%'),
        React.createElement('div', { className: 'metric-bar' },
          React.createElement('div', {
            className: 'metric-bar-fill',
            style: {
              width: `${currentMetrics.diskUsage}%`,
              background: getBarColor(currentMetrics.diskUsage)
            }
          })
        ),
        React.createElement('div', { style: { marginTop: '8px', fontSize: '12px', color: '#888' } },
          '读: ', formatRate(currentMetrics.diskReadRate), ' | 写: ', formatRate(currentMetrics.diskWriteRate)
        )
      ),

      React.createElement('div', { className: 'metric-card' },
        React.createElement('div', { className: 'metric-title' }, '网络传输'),
        React.createElement('div', { style: { display: 'flex', gap: '20px' } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '14px', color: '#888' } }, '下载'),
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#34d399' } },
              formatRate(currentMetrics.networkRxRate)
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '14px', color: '#888' } }, '上传'),
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' } },
              formatRate(currentMetrics.networkTxRate)
            )
          )
        )
      )
    ),

    React.createElement('div', { className: 'charts-container', key: 'charts-' + updateKey },
      CpuChart && React.createElement(CpuChart, { data: metricsHistory, key: 'cpu-' + updateKey }),
      MemoryChart && React.createElement(MemoryChart, { data: metricsHistory, key: 'mem-' + updateKey }),
      DiskChart && React.createElement(DiskChart, { data: metricsHistory, key: 'disk-' + updateKey }),
      NetworkChart && React.createElement(NetworkChart, { data: metricsHistory, key: 'net-' + updateKey })
    ),

    React.createElement('div', { className: 'process-list' },
      React.createElement('div', { className: 'chart-title' }, '🔧 进程管理'),
      React.createElement('div', { className: 'search-box' },
        React.createElement('input', {
          type: 'text',
          placeholder: '搜索进程名称、PID 或用户...',
          style: { flex: 1, padding: '10px 15px', borderRadius: '6px', border: '1px solid #444', background: '#2a2a4e', color: '#eee' },
          value: processSearchTerm,
          onChange: (e) => setProcessSearchTerm(e.target.value),
          onKeyPress: (e) => e.key === 'Enter' && handleSearchProcesses()
        }),
        React.createElement('button', { className: 'action-btn primary', onClick: handleSearchProcesses }, '搜索'),
        processSearchTerm && React.createElement('button', { 
          className: 'action-btn', 
          style: { background: '#555' },
          onClick: () => { setProcessSearchTerm(''); setSearchResults([]); }
        }, '清除')
      ),
      React.createElement('div', { className: 'process-header' },
        React.createElement('div', null, '进程名'),
        React.createElement('div', null, 'PID'),
        React.createElement('div', null, 'CPU使用率'),
        React.createElement('div', null, '内存使用率'),
        React.createElement('div', null, '操作')
      ),
      (searchResults.length > 0 ? searchResults : currentMetrics.processes).slice(0, 15).map((process, index) => (
        React.createElement('div', { 
          className: 'process-row', 
          key: 'proc-' + index + '-' + updateKey,
          onClick: () => handleViewProcessDetail(process.pid)
        },
          React.createElement('div', null, process.name),
          React.createElement('div', null, process.pid),
          React.createElement('div', { style: { color: getBarColor(process.cpuUsage) } }, process.cpuUsage.toFixed(1) + '%'),
          React.createElement('div', { style: { color: getBarColor(process.memoryUsage) } }, process.memoryUsage.toFixed(1) + '%'),
          React.createElement('div', null,
            React.createElement('button', {
              className: 'action-btn primary',
              style: { padding: '4px 10px', fontSize: '12px' },
              onClick: (e) => { e.stopPropagation(); handleViewProcessDetail(process.pid); }
            }, '详情'),
            ' ',
            React.createElement('button', {
              className: 'action-btn danger',
              style: { padding: '4px 10px', fontSize: '12px' },
              onClick: (e) => { e.stopPropagation(); handleKillProcess(process.pid); }
            }, '结束')
          )
        )
      ))
    ),

    React.createElement('div', { className: 'export-section' },
      React.createElement('div', { className: 'chart-title' }, '数据管理与报告导出'),
      React.createElement('div', { className: 'date-inputs' },
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, '数据保留天数:'),
          React.createElement('select', {
            value: retentionDays,
            onChange: (e) => handleRetentionDaysChange(Number(e.target.value))
          },
            React.createElement('option', { value: 1 }, '1天'),
            React.createElement('option', { value: 7 }, '7天'),
            React.createElement('option', { value: 30 }, '30天'),
            React.createElement('option', { value: 90 }, '90天')
          ),
          React.createElement('button', { onClick: handleCleanupData, className: 'action-btn danger' }, '清理过期数据')
        )
      ),
      React.createElement('div', { className: 'date-inputs' },
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, '开始时间:'),
          React.createElement('input', {
            type: 'datetime-local',
            value: exportStartTime,
            onChange: (e) => setExportStartTime(e.target.value)
          })
        ),
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, '结束时间:'),
          React.createElement('input', {
            type: 'datetime-local',
            value: exportEndTime,
            onChange: (e) => setExportEndTime(e.target.value)
          })
        ),
        React.createElement('button', { onClick: () => handleExportReport('system'), className: 'action-btn primary' }, '导出系统报告'),
        React.createElement('button', { onClick: () => handleExportReport('process'), className: 'action-btn primary' }, '导出进程报告')
      )
    ),

    showProcessModal && processDetail && React.createElement('div', { className: 'modal-overlay', onClick: () => setShowProcessModal(false) },
      React.createElement('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h2', null, '📋 进程详情 - ', processDetail.name),
          React.createElement('button', { className: 'close-btn', onClick: () => setShowProcessModal(false) }, '×')
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '进程名称'),
          React.createElement('div', { className: 'detail-value' }, processDetail.name)
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, 'PID'),
          React.createElement('div', { className: 'detail-value' }, processDetail.pid)
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '父进程 PID'),
          React.createElement('div', { className: 'detail-value' }, processDetail.parentPid)
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, 'CPU 使用率'),
          React.createElement('div', { className: 'detail-value', style: { color: getBarColor(processDetail.cpuUsage) } }, processDetail.cpuUsage.toFixed(1), '%')
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '内存使用率'),
          React.createElement('div', { className: 'detail-value', style: { color: getBarColor(processDetail.memoryUsage) } }, processDetail.memoryUsage.toFixed(1), '%')
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '运行用户'),
          React.createElement('div', { className: 'detail-value' }, processDetail.user || '-')
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '优先级'),
          React.createElement('div', { className: 'detail-value' }, processDetail.priority)
        ),
        processDetail.started && React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '启动时间'),
          React.createElement('div', { className: 'detail-value' }, new Date(processDetail.started).toLocaleString())
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '进程路径'),
          React.createElement('div', { className: 'detail-value' }, processDetail.path || '-')
        ),
        React.createElement('div', { className: 'detail-row' },
          React.createElement('div', { className: 'detail-label' }, '命令行'),
          React.createElement('div', { className: 'detail-value' }, processDetail.command || '-')
        ),
        React.createElement('div', { style: { marginTop: '20px', display: 'flex', gap: '10px' } },
          React.createElement('button', {
            className: 'action-btn danger',
            onClick: () => handleKillProcess(processDetail.pid)
          }, '结束进程'),
          React.createElement('button', {
            className: 'action-btn',
            style: { background: '#555' },
            onClick: () => setShowProcessModal(false)
          }, '关闭')
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
