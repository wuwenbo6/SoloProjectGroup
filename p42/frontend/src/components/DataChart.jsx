import React, { useState, useEffect } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, FormControl,
  InputLabel, Select, MenuItem
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function DataChart({ socket }) {
  const [registerType, setRegisterType] = useState('holding_register');
  const [address, setAddress] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setStartTime(oneHourAgo.toISOString().slice(0, 16));
    setEndTime(now.toISOString().slice(0, 16));
  }, []);

  const handleQuery = () => {
    socket.emit('queryHistory', {
      registerType,
      address: parseInt(address),
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: endTime ? new Date(endTime).toISOString() : null
    });

    socket.once('historyData', (data) => {
      const formatted = data.map(item => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        value: item.value
      }));
      setChartData(formatted);
    });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>历史数据查询</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={2}>
              <FormControl fullWidth>
                <InputLabel>寄存器类型</InputLabel>
                <Select
                  value={registerType}
                  onChange={(e) => setRegisterType(e.target.value)}
                  label="寄存器类型"
                >
                  <MenuItem value="coil">线圈</MenuItem>
                  <MenuItem value="discrete_input">离散输入</MenuItem>
                  <MenuItem value="holding_register">保持寄存器</MenuItem>
                  <MenuItem value="input_register">输入寄存器</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="地址" type="number" value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="开始时间" type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="结束时间" type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={2}>
              <Button fullWidth variant="contained" onClick={handleQuery}>
                查询
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3, height: 500 }}>
          <Typography variant="h6" gutterBottom>
            数据趋势图 - {registerType} @ {address}
          </Typography>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default DataChart;
