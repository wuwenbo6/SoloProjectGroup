import React, { useState } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, Chip, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';

function SlaveMonitor({ socket, running, registerData }) {
  const [port, setPort] = useState(502);
  const [setAddr, setSetAddr] = useState(0);
  const [setValue, setSetValue] = useState(0);
  const [registerType, setRegisterType] = useState('holding_register');

  const handleStart = () => {
    socket.emit('startSlave', { port: parseInt(port) });
  };

  const handleStop = () => {
    socket.emit('stopSlave');
  };

  const handleSetRegister = () => {
    socket.emit('setSlaveRegister', {
      registerType,
      address: parseInt(setAddr),
      value: parseInt(setValue)
    });
  };

  const renderTable = (data, label) => {
    const entries = Object.entries(data).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    if (entries.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>{label}</Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>地址</TableCell>
                <TableCell align="right">值</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(([addr, value]) => (
                <TableRow key={addr}>
                  <TableCell>{addr}</TableCell>
                  <TableCell align="right">{value ? 1 : 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderNumberTable = (data, label) => {
    const entries = Object.entries(data).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    if (entries.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>{label}</Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>地址</TableCell>
                <TableCell align="right">值</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(([addr, value]) => (
                <TableRow key={addr}>
                  <TableCell>{addr}</TableCell>
                  <TableCell align="right">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>从站设置</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={4}>
              <TextField
                fullWidth label="端口" type="number" value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={running}
              />
            </Grid>
            <Grid item xs={8}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth variant="contained" color="success"
                  startIcon={<PlayArrow />} onClick={handleStart}
                  disabled={running}
                >
                  启动从站
                </Button>
                <Button
                  fullWidth variant="contained" color="error"
                  startIcon={<Stop />} onClick={handleStop}
                  disabled={!running}
                >
                  停止从站
                </Button>
              </Box>
            </Grid>
          </Grid>
          <Chip 
            label={running ? '运行中' : '已停止'} 
            color={running ? 'success' : 'default'}
            sx={{ mt: 2 }}
          />
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>设置寄存器值</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={3}>
              <TextField
                select fullWidth label="类型" value={registerType}
                onChange={(e) => setRegisterType(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="coil">线圈</option>
                <option value="discrete_input">离散输入</option>
                <option value="holding_register">保持寄存器</option>
                <option value="input_register">输入寄存器</option>
              </TextField>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="地址" type="number" value={setAddr}
                onChange={(e) => setSetAddr(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="值" type="number" value={setValue}
                onChange={(e) => setSetValue(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <Button
                fullWidth variant="contained" onClick={handleSetRegister}
                disabled={!running}
              >
                设置
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>离散量</Typography>
          {renderTable(registerData.coils, '线圈')}
          {renderTable(registerData.discreteInputs, '离散输入')}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>寄存器</Typography>
          {renderNumberTable(registerData.holdingRegisters, '保持寄存器')}
          {renderNumberTable(registerData.inputRegisters, '输入寄存器')}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default SlaveMonitor;
