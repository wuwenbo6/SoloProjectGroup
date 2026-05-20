import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  CssBaseline, Box, Tabs, Tab, Container, Typography
} from '@mui/material';
import io from 'socket.io-client';
import MasterControl from './components/MasterControl';
import SlaveMonitor from './components/SlaveMonitor';
import DataChart from './components/DataChart';
import ScriptEditor from './components/ScriptEditor';
import MqttBridge from './components/MqttBridge';
import FuzzingTest from './components/FuzzingTest';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const socket = io('http://localhost:3001');

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [registerData, setRegisterData] = useState({
    coils: {},
    discreteInputs: {},
    holdingRegisters: {},
    inputRegisters: {}
  });
  const [masterConnected, setMasterConnected] = useState(false);
  const [slaveRunning, setSlaveRunning] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [scriptLogs, setScriptLogs] = useState([]);

  useEffect(() => {
    socket.on('registerUpdate', (data) => {
      setRegisterData(prev => {
      const next = { ...prev };
      switch (data.registerType) {
        case 'coil':
          next.coils = { ...next.coils, [data.address]: data.value };
          break;
        case 'discrete_input':
          next.discreteInputs = { ...next.discreteInputs, [data.address]: data.value };
          break;
        case 'holding_register':
          next.holdingRegisters = { ...next.holdingRegisters, [data.address]: data.value };
          break;
        case 'input_register':
          next.inputRegisters = { ...next.inputRegisters, [data.address]: data.value };
          break;
      }
      return next;
      });
    });

    socket.on('scriptsUpdate', (data) => {
      setScripts(data);
    });

    socket.on('scriptLogsUpdate', (data) => {
      setScriptLogs(data);
    });

    socket.on('masterStatus', (connected) => {
      setMasterConnected(connected);
    });

    socket.on('slaveStatus', (running) => {
      setSlaveRunning(running);
    });

    return () => {
      socket.off('registerUpdate');
      socket.off('scriptsUpdate');
      socket.off('scriptLogsUpdate');
      socket.off('masterStatus');
      socket.off('slaveStatus');
    };
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Container>
            <Typography variant="h4" sx={{ py: 2, fontWeight: 'bold' }}>
              Modbus TCP 调试工具
            </Typography>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="主站控制" />
              <Tab label="从站监控" />
              <Tab label="数据图表" />
              <Tab label="脚本编辑器" />
              <Tab label="MQTT协议桥接" />
              <Tab label="模糊测试" />
            </Tabs>
          </Container>
        </Box>
        <Container sx={{ mt: 3 }}>
          {tabValue === 0 && (
            <MasterControl 
              socket={socket} 
              connected={masterConnected}
              registerData={registerData}
            />
          )}
          {tabValue === 1 && (
            <SlaveMonitor 
              socket={socket} 
              running={slaveRunning}
              registerData={registerData}
            />
          )}
          {tabValue === 2 && (
            <DataChart socket={socket} />
          )}
          {tabValue === 3 && (
            <ScriptEditor 
              socket={socket} 
              scripts={scripts}
              logs={scriptLogs}
            />
          )}
          {tabValue === 4 && (
            <MqttBridge socket={socket} />
          )}
          {tabValue === 5 && (
            <FuzzingTest socket={socket} />
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
