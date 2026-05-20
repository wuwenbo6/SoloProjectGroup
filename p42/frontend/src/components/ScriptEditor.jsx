import React, { useState } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, List,
  ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Chip, Box
} from '@mui/material';
import { PlayArrow, Stop, Delete, Code } from '@mui/icons-material';

const defaultScript = `// 示例：模拟PLC逻辑
// 可用函数：
// setCoil(address, value) - 设置线圈值
// getCoil(address) - 获取线圈值
// setDiscreteInput(address, value) - 设置离散输入
// getDiscreteInput(address) - 获取离散输入
// setHoldingRegister(address, value) - 设置保持寄存器
// getHoldingRegister(address) - 获取保持寄存器
// setInputRegister(address, value) - 设置输入寄存器
// getInputRegister(address) - 获取输入寄存器
// log(message) - 输出日志

// 模拟：计数器每周期+1
const count = getHoldingRegister(0) || 0;
setHoldingRegister(0, count + 1);

// 模拟：当计数达到100时，置位线圈0
if (count >= 100) {
  setCoil(0, true);
} else {
  setCoil(0, false);
}

log('Count: ' + count);`;

function ScriptEditor({ socket, scripts, logs }) {
  const [scriptId, setScriptId] = useState('script_' + Date.now());
  const [scriptCode, setScriptCode] = useState(defaultScript);
  const [interval, setInterval] = useState(1000);

  const handleSave = () => {
    socket.emit('addScript', {
      id: scriptId,
      code: scriptCode,
      interval: parseInt(interval)
    });
  };

  const handleStart = (id) => {
    socket.emit('startScript', id);
  };

  const handleStop = (id) => {
    socket.emit('stopScript', id);
  };

  const handleRemove = (id) => {
    socket.emit('removeScript', id);
  };

  const handleLoad = (script) => {
    setScriptId(script.id);
    setScriptCode(script.code);
    setInterval(script.interval);
  };

  const handleClearLogs = () => {
    socket.emit('clearScriptLogs');
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <Code sx={{ mr: 1, verticalAlign: 'middle' }} />
            脚本编辑器
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth label="脚本ID" value={scriptId}
                onChange={(e) => setScriptId(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth label="执行间隔(ms)" type="number" value={interval}
                onChange={(e) => setInterval(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <Button
                fullWidth variant="contained" sx={{ height: '100%' }}
                onClick={handleSave}
              >
                保存脚本
              </Button>
            </Grid>
          </Grid>
          <TextField
            fullWidth multiline rows={20}
            value={scriptCode}
            onChange={(e) => setScriptCode(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
            variant="outlined"
          />
        </Paper>
      </Grid>

      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>已保存脚本</Typography>
          <List dense>
            {scripts.map((script) => (
              <ListItem 
                key={script.id} 
                button 
                onClick={() => handleLoad(script)}
                sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 1 }}
              >
                <ListItemText 
                  primary={script.id}
                  secondary={`间隔: ${script.interval}ms`}
                />
                <ListItemSecondaryAction>
                  <Chip 
                    size="small"
                    label={script.running ? '运行中' : '已停止'}
                    color={script.running ? 'success' : 'default'}
                    sx={{ mr: 1 }}
                  />
                  {script.running ? (
                    <IconButton size="small" onClick={() => handleStop(script.id)}>
                      <Stop fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton size="small" color="success" onClick={() => handleStart(script.id)}>
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton size="small" color="error" onClick={() => handleRemove(script.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {scripts.length === 0 && (
              <Typography color="textSecondary">暂无脚本</Typography>
            )}
          </List>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">执行日志</Typography>
            <Button size="small" onClick={handleClearLogs}>清空</Button>
          </Box>
          <Box 
            sx={{ 
              maxHeight: 300, 
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              bgcolor: '#1e1e1e',
              p: 2,
              borderRadius: 1
            }}
          >
            {logs.map((log, index) => (
              <div key={index} style={{ color: '#d4d4d4', marginBottom: 4 }}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div style={{ color: '#808080' }}>暂无日志</div>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default ScriptEditor;
