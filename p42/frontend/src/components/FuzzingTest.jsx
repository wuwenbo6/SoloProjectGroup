import React, { useState, useEffect } from 'react';
import {
  Paper, Grid, TextField, Button, Typography, FormControl,
  FormControlLabel, Switch, Select, MenuItem, Chip, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Alert
} from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';

function FuzzingTest({ socket }) {
  const [config, setConfig] = useState({
    host: 'localhost',
    port: 502,
    unitId: 1,
    includeNormal: true,
    includeMalformed: true,
    includeInvalidFunction: true,
    includeBoundary: true,
    includeEdgeValues: true,
    minAddress: 0,
    maxAddress: 100,
    minValue: 0,
    maxValue: 65535,
    normalCount: 10,
    malformedCount: 20,
    invalidFunctionCount: 10,
    delay: 100,
    randomOrder: true
  });

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, errors: 0, warnings: 0 });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on('fuzzingStatus', ({ isRunning: running }) => {
      setIsRunning(running);
    });

    socket.on('fuzzingProgress', (data) => {
      setProgress(data.percent);
      setStats(data.stats);
    });

    socket.on('fuzzingResult', (result) => {
      setResults(prev => [...prev, result]);
    });

    socket.on('fuzzingError', (err) => {
      setError(err.message);
    });

    socket.on('fuzzingResults', (data) => {
      setResults(data.results || []);
      setStats(data.stats || { total: 0, success: 0, failed: 0, errors: 0, warnings: 0 });
    });

    return () => {
      socket.off('fuzzingStatus');
      socket.off('fuzzingProgress');
      socket.off('fuzzingResult');
      socket.off('fuzzingError');
      socket.off('fuzzingResults');
    };
  }, [socket]);

  const handleStart = () => {
    setError(null);
    setResults([]);
    setProgress(0);
    setStats({ total: 0, success: 0, failed: 0, errors: 0, warnings: 0 });
    socket.emit('startFuzzing', config);
  };

  const handleStop = () => {
    socket.emit('stopFuzzing');
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'crash': return 'error';
      default: return 'default';
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      normal: '正常',
      malformed: '异常报文',
      invalid_function: '无效功能码',
      boundary: '边界测试',
      edge_value: '边界值',
      health_check: '健康检查'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      normal: 'primary',
      malformed: 'error',
      invalid_function: 'warning',
      boundary: 'info',
      edge_value: 'secondary',
      health_check: 'default'
    };
    return colors[type] || 'default';
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Modbus TCP 模糊测试配置
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth label="目标主机" value={config.host}
                onChange={(e) => handleConfigChange('host', e.target.value)}
                disabled={isRunning}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth label="端口" type="number" value={config.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                disabled={isRunning}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth label="单元ID" type="number" value={config.unitId}
                onChange={(e) => handleConfigChange('unitId', parseInt(e.target.value))}
                disabled={isRunning}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth label="请求间隔(ms)" type="number" value={config.delay}
                onChange={(e) => handleConfigChange('delay', parseInt(e.target.value))}
                disabled={isRunning}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {!isRunning ? (
                  <Button
                    fullWidth variant="contained" color="primary"
                    startIcon={<PlayArrow />} onClick={handleStart}
                  >
                    开始测试
                  </Button>
                ) : (
                  <Button
                    fullWidth variant="contained" color="error"
                    startIcon={<Stop />} onClick={handleStop}
                  >
                    停止测试
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      {error && (
        <Grid item xs={12}>
          <Alert severity="error">{error}</Alert>
        </Grid>
      )}

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>测试类型</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeNormal}
                    onChange={(e) => handleConfigChange('includeNormal', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="正常读写测试"
              />
              <TextField
                fullWidth size="small" type="number" label="用例数量"
                value={config.normalCount}
                onChange={(e) => handleConfigChange('normalCount', parseInt(e.target.value))}
                disabled={isRunning || !config.includeNormal}
                sx={{ mt: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeMalformed}
                    onChange={(e) => handleConfigChange('includeMalformed', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="异常报文测试（长度错误、协议ID错误等）"
              />
              <TextField
                fullWidth size="small" type="number" label="用例数量"
                value={config.malformedCount}
                onChange={(e) => handleConfigChange('malformedCount', parseInt(e.target.value))}
                disabled={isRunning || !config.includeMalformed}
                sx={{ mt: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeInvalidFunction}
                    onChange={(e) => handleConfigChange('includeInvalidFunction', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="无效功能码测试"
              />
              <TextField
                fullWidth size="small" type="number" label="随机用例数量"
                value={config.invalidFunctionCount}
                onChange={(e) => handleConfigChange('invalidFunctionCount', parseInt(e.target.value))}
                disabled={isRunning || !config.includeInvalidFunction}
                sx={{ mt: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeBoundary}
                    onChange={(e) => handleConfigChange('includeBoundary', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="边界值测试（超大地址、超大数据量）"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeEdgeValues}
                    onChange={(e) => handleConfigChange('includeEdgeValues', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="特殊值写入测试（0、最大值、极值）"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.randomOrder}
                    onChange={(e) => handleConfigChange('randomOrder', e.target.checked)}
                    disabled={isRunning}
                  />
                }
                label="随机执行顺序"
              />
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>统计信息</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  进度 {progress}%
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="h4" color="primary">{stats.total}</Typography>
                <Typography variant="body2" color="text.secondary">总计</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="h4" color="success.main">{stats.success}</Typography>
                <Typography variant="body2" color="text.secondary">成功</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="h4" color="error.main">{stats.errors + stats.warnings}</Typography>
                <Typography variant="body2" color="text.secondary">异常</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            测试结果 ({results.length})
          </Typography>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="80">#</TableCell>
                  <TableCell width="120">类型</TableCell>
                  <TableCell>测试名称</TableCell>
                  <TableCell width="200">结果</TableCell>
                  <TableCell width="100">耗时(ms)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...results].reverse().map((result, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{result.index}/{result.total}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={getTypeLabel(result.type)}
                        color={getTypeColor(result.type)}
                      />
                    </TableCell>
                    <TableCell>{result.name}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={result.message}
                        color={getStatusColor(result.status)}
                      />
                    </TableCell>
                    <TableCell>{result.duration}</TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {isRunning ? '测试进行中...' : '暂无测试结果'}
                      </Typography>
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
          <Typography variant="h6" gutterBottom>测试说明</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                测试类型说明
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>
                  <Typography variant="body2"><strong>正常读写测试</strong>: 随机地址和值的正常读写</Typography>
                </li>
                <li>
                  <Typography variant="body2"><strong>异常报文测试</strong>: 长度过短/过长、MBAP字段错误</Typography>
                </li>
                <li>
                  <Typography variant="body2"><strong>无效功能码测试</strong>: 发送不支持的功能码(0,7-14,127等)</Typography>
                </li>
                <li>
                  <Typography variant="body2"><strong>边界值测试</strong>: 超大地址、超大数据量</Typography>
                </li>
                <li>
                  <Typography variant="body2"><strong>特殊值测试</strong>: 0、最大值、极值写入测试</Typography>
                </li>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="error" gutterBottom>
                风险提示
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>
                  <Typography variant="body2">模糊测试可能导致目标设备崩溃或进入异常状态</Typography>
                </li>
                <li>
                  <Typography variant="body2">建议仅在测试环境中使用，不要对生产设备测试</Typography>
                </li>
                <li>
                  <Typography variant="body2">测试过程中会自动进行健康检查，发现从站无响应时立即停止</Typography>
                </li>
                <li>
                  <Typography variant="body2">崩溃检测结果标记为 Crash，需人工确认设备状态</Typography>
                </li>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default FuzzingTest;
