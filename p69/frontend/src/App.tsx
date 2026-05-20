import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProcessCard } from './components/ProcessCard';
import { AlertPanel } from './components/AlertPanel';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { ToolBar } from './components/ToolBar';
import { useWebSocket } from './hooks/useWebSocket';
import { sensorDataAPI, alertAPI, diagnosticAPI, autoAdjustAPI } from './services/api';
import { SensorData, Alert, ProcessType, DiagnosticResult } from './types';

const BATCH_INTERVAL = 1000;
const MAX_DATA_POINTS = 50;

function App() {
  const [soakingData, setSoakingData] = useState<SensorData[]>([]);
  const [beatingData, setBeatingData] = useState<SensorData[]>([]);
  const [papermakingData, setPapermakingData] = useState<SensorData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const soakingBufferRef = useRef<SensorData[]>([]);
  const beatingBufferRef = useRef<SensorData[]>([]);
  const papermakingBufferRef = useRef<SensorData[]>([]);
  const alertBufferRef = useRef<Alert[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagnosticTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const flushBuffers = useCallback(() => {
    if (soakingBufferRef.current.length > 0) {
      setSoakingData((prev) => {
        const newData = soakingBufferRef.current;
        const ids = new Set(newData.map((d) => d.id));
        const filtered = prev.filter((d) => !ids.has(d.id));
        const result = [...newData, ...filtered].slice(0, MAX_DATA_POINTS);
        soakingBufferRef.current = [];
        return result;
      });
    }

    if (beatingBufferRef.current.length > 0) {
      setBeatingData((prev) => {
        const newData = beatingBufferRef.current;
        const ids = new Set(newData.map((d) => d.id));
        const filtered = prev.filter((d) => !ids.has(d.id));
        const result = [...newData, ...filtered].slice(0, MAX_DATA_POINTS);
        beatingBufferRef.current = [];
        return result;
      });
    }

    if (papermakingBufferRef.current.length > 0) {
      setPapermakingData((prev) => {
        const newData = papermakingBufferRef.current;
        const ids = new Set(newData.map((d) => d.id));
        const filtered = prev.filter((d) => !ids.has(d.id));
        const result = [...newData, ...filtered].slice(0, MAX_DATA_POINTS);
        papermakingBufferRef.current = [];
        return result;
      });
    }

    if (alertBufferRef.current.length > 0) {
      setAlerts((prev) => {
        const newAlerts = alertBufferRef.current;
        const ids = new Set(newAlerts.map((a) => a.id));
        const filtered = prev.filter((a) => !ids.has(a.id));
        const result = [...newAlerts, ...filtered].slice(0, 30);
        alertBufferRef.current = [];
        return result;
      });
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      const [soakingRes, beatingRes, papermakingRes, alertsRes, diagRes, adjustRes] = await Promise.all([
        sensorDataAPI.getRecent('soaking', 30),
        sensorDataAPI.getRecent('beating', 30),
        sensorDataAPI.getRecent('papermaking', 30),
        alertAPI.getActive(20),
        diagnosticAPI.getLatest(),
        autoAdjustAPI.getStatus(),
      ]);

      if (isMountedRef.current) {
        setSoakingData(soakingRes.data.data);
        setBeatingData(beatingRes.data.data);
        setPapermakingData(papermakingRes.data.data);
        setAlerts(alertsRes.data.alerts);
        setDiagnostics(diagRes.data.diagnostics);
        setAutoAdjustEnabled(adjustRes.data.enabled);
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialData();

    flushTimerRef.current = setInterval(flushBuffers, BATCH_INTERVAL);

    const pollDiagnostics = async () => {
      try {
        const res = await diagnosticAPI.getLatest();
        if (isMountedRef.current) {
          setDiagnostics(res.data.diagnostics);
        }
      } catch (error) {
        console.error('Failed to poll diagnostics:', error);
      }
    };
    diagnosticTimerRef.current = setInterval(pollDiagnostics, 30000);

    return () => {
      isMountedRef.current = false;
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
      }
      if (diagnosticTimerRef.current) {
        clearInterval(diagnosticTimerRef.current);
      }
    };
  }, [fetchInitialData, flushBuffers, refreshKey]);

  const handleWebSocketMessage = useCallback((message: { type: string; data?: SensorData; alert?: Alert }) => {
    if (message.type === 'sensor_data' && message.data) {
      const data = message.data;
      switch (data.process_type) {
        case 'soaking':
          soakingBufferRef.current = [data, ...soakingBufferRef.current].slice(0, 10);
          break;
        case 'beating':
          beatingBufferRef.current = [data, ...beatingBufferRef.current].slice(0, 10);
          break;
        case 'papermaking':
          papermakingBufferRef.current = [data, ...papermakingBufferRef.current].slice(0, 10);
          break;
      }
    } else if (message.type === 'alert' && message.alert) {
      alertBufferRef.current = [message.alert, ...alertBufferRef.current].slice(0, 5);
    }
  }, []);

  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:8080/ws`;
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, handleWebSocketMessage]);

  const handleAcknowledge = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleToggleAutoAdjust = useCallback(async (enabled: boolean) => {
    try {
      await autoAdjustAPI.setStatus(enabled);
      setAutoAdjustEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle auto adjust:', error);
    }
  }, []);

  const handleAlertAcknowledge = useCallback(() => {
    handleAcknowledge();
  }, [handleAcknowledge]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>🏭 造纸工序监控操作台</h1>
          <span style={connected ? styles.statusConnected : styles.statusDisconnected}>
            {connected ? '🟢 实时连接中' : '🔴 连接断开'}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.time}>
            {new Date().toLocaleString('zh-CN')}
          </span>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.leftColumn}>
          <ToolBar
            autoAdjustEnabled={autoAdjustEnabled}
            onToggleAutoAdjust={handleToggleAutoAdjust}
          />

          <div style={styles.processGrid}>
            <ProcessCard
              title="浸泡工序"
              processType="soaking"
              data={soakingData}
              icon="💧"
            />
            <ProcessCard
              title="捶打工序"
              processType="beating"
              data={beatingData}
              icon="⚙️"
            />
            <ProcessCard
              title="抄纸工序"
              processType="papermaking"
              data={papermakingData}
              icon="📄"
            />
          </div>
        </div>

        <div style={styles.rightColumn}>
          <DiagnosticPanel diagnostics={diagnostics} />
          <AlertPanel alerts={alerts} onAcknowledge={handleAlertAcknowledge} />
        </div>
      </main>

      <footer style={styles.footer}>
        <p>造纸工业监控系统 v2.0 | 实时数据监测与预警 | 参数自动调整已{autoAdjustEnabled ? '启用' : '禁用'}</p>
      </footer>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#111827',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    backgroundColor: '#1F2937',
    padding: '20px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #374151',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  title: {
    margin: 0,
    color: '#F9FAFB',
    fontSize: '24px',
    fontWeight: 700,
  },
  statusConnected: {
    color: '#10B981',
    fontSize: '14px',
  },
  statusDisconnected: {
    color: '#EF4444',
    fontSize: '14px',
  },
  headerRight: {},
  time: {
    color: '#9CA3AF',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    padding: '30px',
    display: 'flex',
    gap: '30px',
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  rightColumn: {
    width: '380px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',  },
  processGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  footer: {
    backgroundColor: '#1F2937',
    padding: '15px 30px',
    textAlign: 'center',
    borderTop: '1px solid #374151',
  },
};

export default App;
