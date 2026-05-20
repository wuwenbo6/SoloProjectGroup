import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from './components/StatCard';
import DeviceList from './components/DeviceList';
import TranscriptionControl from './components/TranscriptionControl';
import QualityMetrics from './components/QualityMetrics';
import AlertList from './components/AlertList';
import QualityEnhancementPanel from './components/QualityEnhancementPanel';
import BackupPanel from './components/BackupPanel';
import DeviceDiagnosisPanel from './components/DeviceDiagnosisPanel';
import * as apiService from './services/api';

const isEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

function App() {
  const [summary, setSummary] = useState({
    total_devices: 0,
    connected_devices: 0,
    running_sessions: 0,
    active_alerts: 0,
    total_backups: 0,
  });
  const [devices, setDevices] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [qualityHistory, setQualityHistory] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('transcription');
  const [activeSubTab, setActiveSubTab] = useState('quality');
  const [isFetching, setIsFetching] = useState(false);
  
  const lastFetchRef = useRef(0);
  const wsRef = useRef(null);
  const summaryRef = useRef(summary);
  const devicesRef = useRef(devices);
  const sessionsRef = useRef(sessions);
  const alertsRef = useRef(alerts);

  useEffect(() => {
    summaryRef.current = summary;
    devicesRef.current = devices;
    sessionsRef.current = sessions;
    alertsRef.current = alerts;
  }, [summary, devices, sessions, alerts]);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 1500 || isFetching) return;
    
    setIsFetching(true);
    lastFetchRef.current = now;
    
    try {
      const [summaryRes, devicesRes, sessionsRes, alertsRes] = await Promise.all([
        apiService.getDashboardSummary(),
        apiService.getDevices(),
        apiService.getSessions(),
        apiService.getAlerts(),
      ]);

      if (!isEqual(summaryRef.current, summaryRes.data)) {
        setSummary(summaryRes.data);
      }
      if (!isEqual(devicesRef.current, devicesRes.data)) {
        setDevices(devicesRes.data);
      }
      if (!isEqual(sessionsRef.current, sessionsRes.data)) {
        setSessions(sessionsRes.data);
      }
      if (!isEqual(alertsRef.current, alertsRes.data)) {
        setAlerts(alertsRes.data);
      }

      const runningSession = sessionsRes.data.find(s => s.status === 'running' || s.status === 'paused');
      if (runningSession && (!currentSession || runningSession.id !== currentSession.id)) {
        setCurrentSession(runningSession);
      } else if (!runningSession && sessionsRes.data.length > 0 && !currentSession) {
        setCurrentSession(sessionsRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsFetching(false);
    }
  }, [currentSession, isFetching]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current) return;
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/realtime`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
          requestAnimationFrame(() => fetchData());
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchData]);

  useEffect(() => {
    if (currentSession?.quality_params?.length > 0) {
      const history = currentSession.quality_params.slice(-20).map((q, i) => ({
        time: `${i * 2}s`,
        psnr: q.psnr || 42.5,
        ssim: (q.ssim || 0.95) * 100,
      }));
      if (!isEqual(qualityHistory, history)) {
        setQualityHistory(history);
      }
    }
  }, [currentSession, qualityHistory]);

  const handleStart = async () => {
    try {
      await apiService.startTranscription(currentSession?.id);
      fetchData();
    } catch (error) {
      console.error('Error starting transcription:', error);
    }
  };

  const handlePause = async () => {
    if (currentSession) {
      try {
        await apiService.pauseTranscription(currentSession.id);
        fetchData();
      } catch (error) {
        console.error('Error pausing transcription:', error);
      }
    }
  };

  const handleStop = async () => {
    if (currentSession) {
      try {
        await apiService.stopTranscription(currentSession.id);
        fetchData();
      } catch (error) {
        console.error('Error stopping transcription:', error);
      }
    }
  };

  const renderMainContent = () => {
    switch (activeMainTab) {
      case 'backup':
        return (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <BackupPanel devices={devices} api={apiService.default} />
          </div>
        );
      case 'diagnosis':
        return (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <DeviceDiagnosisPanel devices={devices} api={apiService.default} />
          </div>
        );
      default:
        return (
          <>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">转录控制</h2>
              </div>
              
              <TranscriptionControl
                session={currentSession}
                onStart={handleStart}
                onPause={handlePause}
                onStop={handleStop}
              />

              <div className="tabs" style={{ marginTop: '20px' }}>
                <button
                  className={`tab-btn ${activeSubTab === 'quality' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('quality')}
                >
                  画质监控
                </button>
                <button
                  className={`tab-btn ${activeSubTab === 'enhancement' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('enhancement')}
                >
                  画质增强
                </button>
                <button
                  className={`tab-btn ${activeSubTab === 'sessions' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('sessions')}
                >
                  任务历史
                </button>
              </div>

              {activeSubTab === 'quality' ? (
                <QualityMetrics
                  qualityParams={currentSession?.quality_params}
                  qualityHistory={qualityHistory}
                />
              ) : activeSubTab === 'enhancement' ? (
                <QualityEnhancementPanel
                  sessionId={currentSession?.id}
                  api={apiService.default}
                />
              ) : (
                <div className="session-list">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
                      onClick={() => setCurrentSession(session)}
                    >
                      <div className="session-item-info">
                        <h4>{session.session_name || '未命名任务'}</h4>
                        <p>创建于: {new Date(session.created_at).toLocaleString('zh-CN')}</p>
                      </div>
                      <div className="session-item-progress">
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{session.progress.toFixed(1)}%</span>
                        <div className="small-progress-bar">
                          <div className="fill" style={{ width: `${session.progress}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">设备状态</h2>
                </div>
                <DeviceList devices={devices} />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">系统警报</h2>
                </div>
                <AlertList alerts={alerts} />
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎞️ 胶片转录监控操作台</h1>
        <div className="connection-status">
          <span className="status-dot" style={{ backgroundColor: wsConnected ? '#4caf50' : '#f44336' }} />
          {wsConnected ? '实时连接' : '连接断开'}
        </div>
      </header>

      <div className="dashboard-grid">
        <StatCard title="总设备数" value={summary.total_devices} type="devices" />
        <StatCard title="已连接设备" value={summary.connected_devices} type="connected" />
        <StatCard title="运行任务" value={summary.running_sessions} type="running" />
        <StatCard title="活跃警报" value={summary.active_alerts} type="alerts" />
      </div>

      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`tab-btn ${activeMainTab === 'transcription' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('transcription')}
        >
          转录监控
        </button>
        <button
          className={`tab-btn ${activeMainTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('backup')}
        >
          参数备份
        </button>
        <button
          className={`tab-btn ${activeMainTab === 'diagnosis' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('diagnosis')}
        >
          设备诊断
        </button>
      </div>

      <div className="main-content">
        {renderMainContent()}
      </div>
    </div>
  );
}

export default App;
