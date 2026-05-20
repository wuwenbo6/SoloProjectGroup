import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
import DeviceStatusCard from './components/DeviceStatusCard';
import CollectionProgress from './components/CollectionProgress';
import CharacterDisplay from './components/CharacterDisplay';
import CharacterComparison from './components/CharacterComparison';
import AlertPanel from './components/AlertPanel';
import HistoryRecords from './components/HistoryRecords';
import ConfigPanel from './components/ConfigPanel';
import ConfigBackupPanel from './components/ConfigBackupPanel';
import DeviceDiagnosticPanel from './components/DeviceDiagnosticPanel';
import { deviceAPI, collectionAPI, diagnosticAPI } from './services/api';
import { Keyboard, Wifi, WifiOff, Menu, X, Columns, Grid, Layers } from 'lucide-react';

function AppContent() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessionInfo, setSessionInfo] = useState({
    isCollecting: false,
    sessionId: null,
    startTime: null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('monitor');
  const { wsConnected, subscribe } = useWebSocket();
  const selectedDeviceRef = useRef(selectedDevice);

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await deviceAPI.getAll();
      setDevices(response.data);
      if (response.data.length > 0 && !selectedDeviceRef.current) {
        setSelectedDevice(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    const characterUnsub = subscribe('character_collected', (messages) => {
      const selected = selectedDeviceRef.current;
      if (!selected) return;
      
      const newChars = messages.filter(
        m => m.device_id === selected.device_id
      );
      if (newChars.length > 0) {
        setCharacters(prev => {
          const updated = [...prev, ...newChars];
          return updated.slice(-1000);
        });
      }
    });

    const startUnsub = subscribe('collection_started', (messages) => {
      const msg = messages[messages.length - 1];
      const selected = selectedDeviceRef.current;
      if (selected && msg.device_id === selected.device_id) {
        setSessionInfo({
          isCollecting: true,
          sessionId: msg.session_id,
          startTime: new Date().toISOString(),
        });
        setCharacters([]);
        fetchDevices();
      }
    });

    const stopUnsub = subscribe('collection_stopped', (messages) => {
      const msg = messages[messages.length - 1];
      const selected = selectedDeviceRef.current;
      if (selected && msg.device_id === selected.device_id) {
        setSessionInfo({
          isCollecting: false,
          sessionId: null,
          startTime: null,
        });
        fetchDevices();
      }
    });

    const statusUnsub = subscribe('device_status', () => {
      fetchDevices();
    });

    const alertUnsub = subscribe('alert', (messages) => {
      setAlerts(prev => [...messages.reverse(), ...prev].slice(0, 30));
    });

    const configUnsub = subscribe('config_restored', () => {
      fetchDevices();
    });

    return () => {
      characterUnsub();
      startUnsub();
      stopUnsub();
      statusUnsub();
      alertUnsub();
      configUnsub();
    };
  }, [subscribe, fetchDevices]);

  const handleConnect = async (deviceId) => {
    try {
      await deviceAPI.connect(deviceId);
      fetchDevices();
    } catch (error) {
      console.error('Failed to connect device:', error);
    }
  };

  const handleDisconnect = async (deviceId) => {
    try {
      await deviceAPI.disconnect(deviceId);
      fetchDevices();
    } catch (error) {
      console.error('Failed to disconnect device:', error);
    }
  };

  const handleStartCollect = async (deviceId) => {
    try {
      await collectionAPI.start(deviceId);
    } catch (error) {
      console.error('Failed to start collection:', error);
    }
  };

  const handleStopCollect = async (deviceId) => {
    try {
      await collectionAPI.stop(deviceId);
    } catch (error) {
      console.error('Failed to stop collection:', error);
    }
  };

  const handleDismissAlert = (index) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  };

  const tabs = [
    { id: 'monitor', label: '监控面板', icon: <Columns className="w-4 h-4" /> },
    { id: 'comparison', label: '字符对比', icon: <Grid className="w-4 h-4" /> },
    { id: 'config', label: '配置管理', icon: <Layers className="w-4 h-4" /> },
    { id: 'diagnostics', label: '设备诊断', icon: <Keyboard className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Keyboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">打字机字符采集监控台</h1>
                <p className="text-sm text-gray-500 hidden sm:block">实时监控 · 数据采集 · 远程控制</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg ${
                wsConnected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              }`}>
                {wsConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                  {wsConnected ? 'WebSocket已连接' : '连接断开'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={`
          ${sidebarOpen ? 'w-64' : 'w-0'} 
          transition-all duration-300 overflow-hidden
          border-r border-gray-200 bg-white
          fixed lg:sticky top-16 bottom-0 z-40
          lg:h-[calc(100vh-4rem)]
          lg:block
        `}>
          <div className="p-4 h-full overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">设备列表</h3>
            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.device_id}
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedDevice?.device_id === device.device_id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{device.name}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      device.status === 'online' ? 'bg-success' :
                      device.status === 'collecting' ? 'bg-primary' : 'bg-danger'
                    }`} />
                  </div>
                  <div className="text-xs text-gray-500">{device.device_id}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">功能模块</h3>
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.icon}
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="p-4 sm:p-6">
            <div className="lg:hidden mb-4 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'monitor' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {devices.map((device) => (
                    <DeviceStatusCard
                      key={device.device_id}
                      device={device}
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                      onStartCollect={handleStartCollect}
                      onStopCollect={handleStopCollect}
                    />
                  ))}
                </div>

                <CollectionProgress
                  characters={characters}
                  sessionInfo={sessionInfo}
                />

                <CharacterDisplay
                  characters={characters}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <AlertPanel
                    alerts={alerts}
                    onDismiss={handleDismissAlert}
                  />
                  <HistoryRecords />
                </div>
              </div>
            )}

            {activeTab === 'comparison' && (
              <div className="space-y-6">
                <CharacterComparison characters={characters} />
              </div>
            )}

            {activeTab === 'config' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConfigPanel
                  selectedDevice={selectedDevice}
                  onDeviceAdded={fetchDevices}
                  onConfigUpdated={fetchDevices}
                />
                <ConfigBackupPanel
                  selectedDevice={selectedDevice}
                  onConfigRestored={fetchDevices}
                />
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DeviceDiagnosticPanel
                  selectedDevice={selectedDevice}
                  onRefresh={fetchDevices}
                />
                <div className="space-y-6">
                  <AlertPanel
                    alerts={alerts}
                    onDismiss={handleDismissAlert}
                  />
                  <HistoryRecords />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500">
          打字机字符采集监控系统 © 2024 | 后端: FastAPI + SQLite | 前端: React + Tailwind CSS
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;