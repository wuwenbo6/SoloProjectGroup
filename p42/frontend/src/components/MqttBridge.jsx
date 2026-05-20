import React, { useState, useEffect } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, FormControl,
  InputLabel, Select, MenuItem, Chip, Box, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Switch, FormControlLabel, Divider
} from '@mui/material';
import { PlayArrow, Stop, Send, Delete } from '@mui/icons-material';

function MqttBridge({ socket }) {
  const [mqttConfig, setMqttConfig] = useState({
    host: 'localhost',
    port: 1883,
    username: '',
    password: '',
    clientId: `modbus-bridge-${Date.now()}`,
    publishTopic: 'modbus/data',
    subscribeTopic: 'modbus/command',
    qos: 0,
    retain: false
  });
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [command, setCommand] = useState({
    action: 'read',
    host: 'localhost',
    port: 502,
    unitId: 1,
    registerType: 'holding_register',
    address: 0,
    quantity: 1,
    value: 0
  });

  useEffect(() => {
    socket.on('mqttStatus', ({ connected: isConnected, config }) => {
      setConnected(isConnected);
      if (config) {
        setMqttConfig(prev => ({ ...prev, ...config }));
      }
    });

    socket.on('mqttLogUpdate', (logs) => {
      setMessages(logs);
    });

    socket.on('mqttMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('mqttError', (error) => {
      console.error('MQTT Error:', error.message);
    });

    return () => {
      socket.off('mqttStatus');
      socket.off('mqttLogUpdate');
      socket.off('mqttMessage');
      socket.off('mqttError');
    };
  }, [socket]);

  const handleConnect = () => {
    socket.emit('mqttConnect', mqttConfig);
  };

  const handleDisconnect = () => {
    socket.emit('mqttDisconnect');
  };

  const handleSendCommand = () => {
    socket.emit('mqttSendCommand', command);
  };

  const handleConfigChange = (field, value) => {
    setMqttConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleCommandChange = (field, value) => {
    setCommand(prev => ({ ...prev, [field]: value }));
  };

  const getDirectionColor = (direction) => {
    switch (direction) {
      case 'publish': return 'success';
      case 'command': return 'primary';
      case 'receive': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            MQTT 连接配置
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField
                fullWidth label="MQTT Broker 地址" value={mqttConfig.host}
                onChange={(e) => handleConfigChange('host', e.target.value)}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth label="端口" type="number" value={mqttConfig.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="用户名" value={mqttConfig.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="密码" type="password" value={mqttConfig.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="发布主题前缀" value={mqttConfig.publishTopic}
                onChange={(e) => handleConfigChange('publishTopic', e.target.value)}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="订阅命令主题" value={mqttConfig.subscribeTopic}
                onChange={(e) => handleConfigChange('subscribeTopic', e.target.value)}
                disabled={connected}
              />
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth disabled={connected}>
                <InputLabel>QoS 级别</InputLabel>
                <Select
                  value={mqttConfig.qos}
                  onChange={(e) => handleConfigChange('qos', parseInt(e.target.value))}
                  label="QoS 级别"
                >
                  <MenuItem value={0}>0 - 最多一次</MenuItem>
                  <MenuItem value={1}>1 - 至少一次</MenuItem>
                  <MenuItem value={2}>2 - 恰好一次</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={mqttConfig.retain}
                    onChange={(e) => handleConfigChange('retain', e.target.checked)}
                    disabled={connected}
                  />
                }
                label="保留消息"
              />
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!connected ? (
                  <Button
                    fullWidth variant="contained" color="success"
                    startIcon={<PlayArrow />} onClick={handleConnect}
                  >
                    连接
                  </Button>
                ) : (
                  <Button
                    fullWidth variant="contained" color="error"
                    startIcon={<Stop />} onClick={handleDisconnect}
                  >
                    断开
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Chip 
              label={connected ? 'MQTT 已连接' : 'MQTT 未连接'} 
              color={connected ? 'success' : 'default'}
            />
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            发送 MQTT 命令
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <FormControl fullWidth disabled={!connected}>
                <InputLabel>命令类型</InputLabel>
                <Select
                  value={command.action}
                  onChange={(e) => handleCommandChange('action', e.target.value)}
                  label="命令类型"
                >
                  <MenuItem value="read">读取寄存器</MenuItem>
                  <MenuItem value="write">写入寄存器</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth label="从站主机" value={command.host}
                onChange={(e) => handleCommandChange('host', e.target.value)}
                disabled={!connected}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="端口" type="number" value={command.port}
                onChange={(e) => handleCommandChange('port', parseInt(e.target.value))}
                disabled={!connected}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth label="单元ID" type="number" value={command.unitId}
                onChange={(e) => handleCommandChange('unitId', parseInt(e.target.value))}
                disabled={!connected}
              />
            </Grid>
            <Grid item xs={3}>
              <FormControl fullWidth disabled={!connected}>
                <InputLabel>寄存器类型</InputLabel>
                <Select
                  value={command.registerType}
                  onChange={(e) => handleCommandChange('registerType', e.target.value)}
                  label="寄存器类型"
                >
                  <MenuItem value="coil">线圈 (Coil)</MenuItem>
                  <MenuItem value="discrete_input">离散输入</MenuItem>
                  <MenuItem value="holding_register">保持寄存器</MenuItem>
                  <MenuItem value="input_register">输入寄存器</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="地址" type="number" value={command.address}
                onChange={(e) => handleCommandChange('address', parseInt(e.target.value))}
                disabled={!connected}
              />
            </Grid>
            {command.action === 'read' ? (
              <Grid item xs={3}>
                <TextField
                  fullWidth label="数量" type="number" value={command.quantity}
                  onChange={(e) => handleCommandChange('quantity', parseInt(e.target.value))}
                  disabled={!connected}
                />
              </Grid>
            ) : (
              <Grid item xs={3}>
                <TextField
                  fullWidth label="值" type="number" value={command.value}
                  onChange={(e) => handleCommandChange('value', parseInt(e.target.value))}
                  disabled={!connected}
                />
              </Grid>
            )}
            <Grid item xs={3}>
              <Button
                fullWidth variant="contained" startIcon={<Send />}
                onClick={handleSendCommand} disabled={!connected}
                sx={{ height: '100%' }}
              >
                发送命令
              </Button>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              命令将发送到主题: <code>{mqttConfig.subscribeTopic}</code>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              响应将发布到: <code>{mqttConfig.publishTopic}/response</code>
            </Typography>
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">MQTT 消息日志</Typography>
            <Button 
              size="small" onClick={() => setMessages([])}
              startIcon={<Delete />}
            >
              清空日志
            </Button>
          </Box>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="100">方向</TableCell>
                  <TableCell>主题</TableCell>
                  <TableCell>消息内容</TableCell>
                  <TableCell width="180">时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...messages].reverse().map((msg, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={msg.direction === 'publish' ? '发布' : msg.direction === 'command' ? '命令' : '接收'}
                        color={getDirectionColor(msg.direction)}
                      />
                    </TableCell>
                    <TableCell><code>{msg.topic}</code></TableCell>
                    <TableCell>
                      <Box 
                        component="pre" 
                        sx={{ 
                          m: 0, p: 1, bgcolor: 'background.default', 
                          borderRadius: 1, fontSize: 12, maxHeight: 80, overflow: 'auto'
                        }}
                      >
                        {JSON.stringify(msg.payload, null, 2)}
                      </Box>
                    </TableCell>
                    <TableCell>{new Date(msg.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {messages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">暂无消息</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>协议转换说明</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Modbus → MQTT (数据上报)
              </Typography>
              <Typography variant="body2" paragraph>
                当轮询到寄存器数据变化时，自动发布到 MQTT 主题：
              </Typography>
              <Box component="pre" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, fontSize: 12 }}>
{`# 主站数据
{prefix}/{registerType}/{address}

# 从站模拟数据  
{prefix}/slave/{registerType}/{address}

# 消息格式
{
  "value": 123,
  "unitId": 1,
  "host": "192.168.1.100",
  "port": 502,
  "timestamp": "2024-01-01T12:00:00.000Z"
}`}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="secondary">
                MQTT → Modbus (命令下发)
              </Typography>
              <Typography variant="body2" paragraph>
                向订阅主题发送 JSON 命令，控制 Modbus 读写：
              </Typography>
              <Box component="pre" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, fontSize: 12 }}>
{`# 读取命令
{
  "action": "read",
  "host": "192.168.1.100",
  "port": 502,
  "unitId": 1,
  "registerType": "holding_register",
  "address": 0,
  "quantity": 10
}

# 写入命令
{
  "action": "write",
  "host": "192.168.1.100", 
  "port": 502,
  "unitId": 1,
  "registerType": "coil",
  "address": 0,
  "value": true
}`}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default MqttBridge;
