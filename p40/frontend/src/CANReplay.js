import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8080/api/can';

function CANReplay() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [filename, setFilename] = useState('sample_can_log.json');
  const [speedFactor, setSpeedFactor] = useState(1.0);
  const [loopCount, setLoopCount] = useState(1);
  const [startOffset, setStartOffset] = useState(0);
  const [endOffset, setEndOffset] = useState(0);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setStatus(data.status);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/progress`);
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
      if (status === 'playing') {
        fetchProgress();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchProgress, status]);

  const generateSampleLog = async () => {
    try {
      const res = await fetch(`${API_BASE}/generate-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          num_messages: 1000,
          interval_ms: 10,
        }),
      });
      const data = await res.json();
      setMessage(data.message || 'Sample log generated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to generate sample log');
    }
  };

  const loadLogFile = async () => {
    try {
      const res = await fetch(`${API_BASE}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      setMessage(data.message || 'Log file loaded');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to load log file');
    }
  };

  const startReplay = async () => {
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_factor: parseFloat(speedFactor),
          loop_count: parseInt(loopCount),
          start_offset_ms: parseInt(startOffset),
          end_offset_ms: parseInt(endOffset),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('playing');
        setMessage(data.message || 'Replay started');
      } else {
        setMessage(data.error || 'Failed to start replay');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to start replay');
    }
  };

  const pauseReplay = async () => {
    try {
      const res = await fetch(`${API_BASE}/pause`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus('paused');
        setMessage(data.message || 'Replay paused');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to pause replay');
    }
  };

  const resumeReplay = async () => {
    try {
      const res = await fetch(`${API_BASE}/resume`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus('playing');
        setMessage(data.message || 'Replay resumed');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to resume replay');
    }
  };

  const stopReplay = async () => {
    try {
      const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus('stopped');
        setProgress(null);
        setMessage(data.message || 'Replay stopped');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to stop replay');
    }
  };

  const styles = {
    container: {
      backgroundColor: '#16213e',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: '15px',
    },
    statusBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '15px',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
    },
    statusDot: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: status === 'playing' ? '#00ff88' :
                       status === 'paused' ? '#ffaa00' :
                       status === 'error' ? '#ff4444' : '#666',
      boxShadow: `0 0 8px ${status === 'playing' ? '#00ff88' :
                  status === 'paused' ? '#ffaa00' :
                  status === 'error' ? '#ff4444' : '#666'}`,
    },
    statusText: {
      color: '#fff',
      fontSize: '14px',
    },
    inputGroup: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px',
      marginBottom: '15px',
    },
    input: {
      padding: '10px',
      backgroundColor: '#0d1424',
      border: '1px solid #333',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '13px',
    },
    label: {
      display: 'block',
      color: '#aaa',
      fontSize: '12px',
      marginBottom: '5px',
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginBottom: '15px',
    },
    button: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    primaryBtn: {
      backgroundColor: '#00d4ff',
      color: '#fff',
    },
    successBtn: {
      backgroundColor: '#00ff88',
      color: '#000',
    },
    warningBtn: {
      backgroundColor: '#ffaa00',
      color: '#000',
    },
    dangerBtn: {
      backgroundColor: '#ff4444',
      color: '#fff',
    },
    disabledBtn: {
      backgroundColor: '#333',
      color: '#666',
      cursor: 'not-allowed',
    },
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: '#0d1424',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '10px',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#00d4ff',
      transition: 'width 0.3s',
    },
    progressText: {
      display: 'flex',
      justifyContent: 'space-between',
      color: '#888',
      fontSize: '12px',
      marginTop: '5px',
    },
    message: {
      padding: '10px',
      backgroundColor: 'rgba(0,212,255,0.2)',
      color: '#00d4ff',
      borderRadius: '6px',
      fontSize: '13px',
      textAlign: 'center',
    },
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🔧 CAN 日志回放</h2>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.statusBar}>
        <span style={styles.statusDot}></span>
        <span style={styles.statusText}>
          状态: {status === 'playing' ? '播放中' :
                  status === 'paused' ? '已暂停' :
                  status === 'stopped' ? '已停止' :
                  status === 'error' ? '错误' : '空闲'}
        </span>
      </div>

      {progress && (
        <>
          <div style={styles.progressBar}>
            <div style={{...styles.progressFill, width: `${progress.percent || 0}%`}}></div>
          </div>
          <div style={styles.progressText}>
            <span>消息: {progress.current_index} / {progress.total_messages || 0}</span>
            <span>进度: {progress.percent?.toFixed(1) || 0}%</span>
          </div>
        </>
      )}

      <div style={styles.inputGroup}>
        <div>
          <label style={styles.label}>日志文件名</label>
          <input
            style={styles.input}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="sample_can_log.json"
          />
        </div>
        <div>
          <label style={styles.label}>播放速度</label>
          <input
            style={styles.input}
            type="number"
            value={speedFactor}
            onChange={(e) => setSpeedFactor(e.target.value)}
            step="0.5"
            min="0.1"
          />
        </div>
        <div>
          <label style={styles.label}>循环次数 (0=无限)</label>
          <input
            style={styles.input}
            type="number"
            value={loopCount}
            onChange={(e) => setLoopCount(e.target.value)}
            min="0"
          />
        </div>
        <div>
          <label style={styles.label}>起始偏移 (ms)</label>
          <input
            style={styles.input}
            type="number"
            value={startOffset}
            onChange={(e) => setStartOffset(e.target.value)}
            min="0"
          />
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button
          style={{...styles.button, ...styles.primaryBtn}}
          onClick={generateSampleLog}
          disabled={status === 'playing'}
        >
          生成示例日志
        </button>
        <button
          style={{...styles.button, ...styles.primaryBtn}}
          onClick={loadLogFile}
          disabled={status === 'playing'}
        >
          加载日志文件
        </button>
        <button
          style={{...styles.button, ...(status === 'playing' ? styles.disabledBtn : styles.successBtn)}}
          onClick={startReplay}
          disabled={status === 'playing'}
        >
          开始回放
        </button>
        <button
          style={{...styles.button, ...(status === 'playing' ? styles.warningBtn : styles.disabledBtn)}}
          onClick={pauseReplay}
          disabled={status !== 'playing'}
        >
          暂停
        </button>
        <button
          style={{...styles.button, ...(status === 'paused' ? styles.successBtn : styles.disabledBtn)}}
          onClick={resumeReplay}
          disabled={status !== 'paused'}
        >
          继续
        </button>
        <button
          style={{...styles.button, ...((status === 'playing' || status === 'paused') ? styles.dangerBtn : styles.disabledBtn)}}
          onClick={stopReplay}
          disabled={status !== 'playing' && status !== 'paused'}
        >
          停止
        </button>
      </div>

      <div style={{color: '#888', fontSize: '12px', marginTop: '15px'}}>
        <p>💡 <strong>修复说明:</strong></p>
        <ul style={{marginLeft: '20px', marginTop: '5px'}}>
          <li>按原始时间戳间隔延时发送，避免瞬时冲击</li>
          <li>支持 0.1x ~ 10x 倍速播放</li>
          <li>暂停后继续会重新计算延时基点</li>
          <li>ECU模拟器带缓冲队列，防止消息堆积崩溃</li>
        </ul>
      </div>
    </div>
  );
}

export default CANReplay;
