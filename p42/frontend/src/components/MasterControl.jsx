import React, { useState, useEffect } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, FormControl,
  InputLabel, Select, MenuItem, Chip, Box, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import { PlayArrow, Stop, Refresh, Delete } from '@mui/icons-material';

function MasterControl({ socket, connected, registerData }) {
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(502);
  const [unitId, setUnitId] = useState(1);
  const [timeout, setTimeout] = useState(5000);
  const [connectedSlaves, setConnectedSlaves] = useState([]);
  const [selectedSlave, setSelectedSlave] = useState(null);
  const [registerType, setRegisterType] = useState('holding_register');
  const [startAddress, setStartAddress] = useState(0);
  const [quantity, setQuantity] = useState(10);
  const [interval, setInterval] = useState(1000);
  const [pollingTasks, setPollingTasks] = useState([]);
  const [writeAddress, setWriteAddress] = useState(0);
  const [writeValue, setWriteValue] = useState(0);

  useEffect(() => {
    socket.on('pollingTasksUpdate', (tasks) => {
      setPollingTasks(tasks);
    });
    return () => {
      socket.off('pollingTasksUpdate');
    };
  }, [socket]);

  const handleConnect = () => {
    socket.emit('masterConnect', { host, port: parseInt(port), unitId: parseInt(unitId), timeout: parseInt(timeout) });
    const newSlave = { host, port: parseInt(port), unitId: parseInt(unitId) };
    setConnectedSlaves(prev => {
      const exists = prev.find(s => s.host === host && s.port === parseInt(port) && s.unitId === parseInt(unitId));
      if (exists) return prev;
      return [...prev, newSlave];
    });
    if (!selectedSlave) {
      setSelectedSlave(newSlave);
    }
  };

  const handleDisconnectSlave = (slave) => {
    socket.emit('masterDisconnect', slave);
    setConnectedSlaves(prev => prev.filter(s => !(s.host === slave.host && s.port === slave.port && s.unitId === slave.unitId)));
    if (selectedSlave && selectedSlave.host === slave.host && selectedSlave.port === slave.port && selectedSlave.unitId === slave.unitId) {
      setSelectedSlave(connectedSlaves.length > 1 ? connectedSlaves[0] : null);
    }
  };

  const handleDisconnectAll = () => {
    socket.emit('masterDisconnect', {});
    setConnectedSlaves([]);
    setSelectedSlave(null);
  };

  const handleStartPolling = () => {
    if (!selectedSlave) return;
    socket.emit('startPolling', {
      host: selectedSlave.host,
      port: selectedSlave.port,
      unitId: selectedSlave.unitId,
      registerType,
      startAddress: parseInt(startAddress),
      quantity: parseInt(quantity),
      interval: parseInt(interval)
    });
  };

  const handleStopPolling = (taskId) => {
    socket.emit('stopPolling', taskId);
  };

  const handleStopAllPolling = () => {
    socket.emit('stopAllPolling');
  };

  const handleWrite = () => {
    if (!selectedSlave) return;
    socket.emit('writeRegister', {
      host: selectedSlave.host,
      port: selectedSlave.port,
      unitId: selectedSlave.unitId,
      registerType,
      address: parseInt(writeAddress),
      value: parseInt(writeValue)
    });
  };

  const renderRegisterTable = (data, label) => {
    const entries = Object.entries(data).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    if (entries.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6">{label}</Typography>
        <Grid container spacing={1}>
          {entries.slice(0, 20).map(([addr, value]) => (
            <Grid item key={addr}>
              <Chip label={`${addr}: ${value}`} color="primary" variant="outlined" />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>连接设置</Typography>
          <Grid container spacing={2}>
            <Grid item xs={5}>
              <TextField
                fullWidth label="主机地址" value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="端口" type="number" value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="单元ID" type="number" value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="超时(ms)" type="number" value={timeout}
                onChange={(e) => setTimeout(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth variant="contained" color="success"
                startIcon={<PlayArrow />} onClick={handleConnect}
              >
                连接从站
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth variant="contained" color="error"
                startIcon={<Stop />} onClick={handleDisconnectAll}
                disabled={connectedSlaves.length === 0}
              >
                断开全部
              </Button>
            </Grid>
          </Grid>
          
          {connectedSlaves.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">已连接从站 ({connectedSlaves.length}):</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>地址</TableCell>
                      <TableCell>端口</TableCell>
                      <TableCell>单元ID</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {connectedSlaves.map((slave, idx) => (
                      <TableRow 
                        key={idx}
                        selected={selectedSlave && selectedSlave.host === slave.host && selectedSlave.port === slave.port && selectedSlave.unitId === slave.unitId}
                        onClick={() => setSelectedSlave(slave)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{slave.host}</TableCell>
                        <TableCell>{slave.port}</TableCell>
                        <TableCell>{slave.unitId}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleDisconnectSlave(slave)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>轮询设置</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth disabled={!selectedSlave}>
                <InputLabel>目标从站</InputLabel>
                <Select
                  value={selectedSlave ? `${selectedSlave.host}:${selectedSlave.port}:${selectedSlave.unitId}` : ''}
                  onChange={(e) => {
                    const [h, p, u] = e.target.value.split(':');
                    setSelectedSlave({ host: h, port: parseInt(p), unitId: parseInt(u) });
                  }}
                  label="目标从站"
                >
                  {connectedSlaves.map((slave, idx) => (
                    <MenuItem key={idx} value={`${slave.host}:${slave.port}:${slave.unitId}`}>
                      {slave.host}:{slave.port} (ID: {slave.unitId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth disabled={!selectedSlave}>
                <InputLabel>寄存器类型</InputLabel>
                <Select
                  value={registerType}
                  onChange={(e) => setRegisterType(e.target.value)}
                  label="寄存器类型"
                >
                  <MenuItem value="coil">线圈 (Coil)</MenuItem>
                  <MenuItem value="discrete_input">离散输入</MenuItem>
                  <MenuItem value="holding_register">保持寄存器</MenuItem>
                  <MenuItem value="input_register">输入寄存器</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="起始地址" type="number" value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                disabled={!selectedSlave}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="数量" type="number" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!selectedSlave}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="间隔(ms)" type="number" value={interval}
                onChange={(e) => setInterval(e.target.value)}
                disabled={!selectedSlave}
              />
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth variant="contained" startIcon={<PlayArrow />}
                  onClick={handleStartPolling} disabled={!selectedSlave}
                >
                  开始轮询
                </Button>
                <Button
                  fullWidth variant="contained" color="error" startIcon={<Stop />}
                  onClick={handleStopAllPolling}
                >
                  停止全部
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>写寄存器</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={3}>
              <FormControl fullWidth disabled={!selectedSlave}>
                <InputLabel>寄存器类型</InputLabel>
                <Select
                  value={registerType}
                  onChange={(e) => setRegisterType(e.target.value)}
                  label="寄存器类型"
                >
                  <MenuItem value="coil">线圈</MenuItem>
                  <MenuItem value="holding_register">保持寄存器</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="地址" type="number" value={writeAddress}
                onChange={(e) => setWriteAddress(e.target.value)}
                disabled={!selectedSlave}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="值" type="number" value={writeValue}
                onChange={(e) => setWriteValue(e.target.value)}
                disabled={!selectedSlave}
              />
            </Grid>
            <Grid item xs={3}>
              <Button
                fullWidth variant="contained" onClick={handleWrite}
                disabled={!selectedSlave}
              >
                写入
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>实时数据</Typography>
          {renderRegisterTable(registerData.coils, '线圈')}
          {renderRegisterTable(registerData.discreteInputs, '离散输入')}
          {renderRegisterTable(registerData.holdingRegisters, '保持寄存器')}
          {renderRegisterTable(registerData.inputRegisters, '输入寄存器')}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default MasterControl;
