import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SIGNALING_SERVER = 'http://localhost:3001';

function App() {
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState('未连接');
  const [mode, setMode] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [showClipboardModal, setShowClipboardModal] = useState(false);
  const [clipboardText, setClipboardText] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastMouseSendRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const canvasRef = useRef(null);
  const broadcastIntervalRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER);

    socketRef.current.on('connect', () => {
      setStatus('已连接到信令服务器');
      socketRef.current.emit('get-hosts');
    });

    socketRef.current.on('host-list', (hostList) => {
      setHosts(hostList);
    });

    socketRef.current.on('answer', async (data) => {
      const { answer } = data;
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        setStatus('WebRTC连接已建立');
        setIsConnected(true);
      }
    });

    socketRef.current.on('ice-candidate', async (data) => {
      const { candidate } = data;
      if (peerConnectionRef.current && candidate) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });

    socketRef.current.on('stream-frame', (data) => {
      if (canvasRef.current && mode === 'view') {
        const ctx = canvasRef.current.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        };
        img.src = data;
      }
    });

    socketRef.current.on('view-joined', (data) => {
      setStatus(`已加入观看模式: ${data.hostId}`);
      startBroadcast();
    });

    socketRef.current.on('control-granted', (data) => {
      setStatus('已获得控制权');
    });

    socketRef.current.on('control-denied', (data) => {
      setStatus(`控制被拒绝: ${data.reason}`);
    });

    socketRef.current.on('disconnect', () => {
      setStatus('与信令服务器断开连接');
      setIsConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanup();
      stopBroadcast();
    };
  }, [mode]);

  const cleanup = useCallback((fullCleanup = true) => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      const senders = peerConnectionRef.current.getSenders();
      senders.forEach(sender => {
        peerConnectionRef.current.removeTrack(sender);
      });
    }

    if (fullCleanup) {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      setIsCapturing(false);
    }
    setIsConnected(false);
    setSelectedHost(null);
    setMode(null);
  }, []);

  const startScreenCapture = async () => {
    if (streamRef.current) {
      setStatus('屏幕捕获已在运行');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
      setStatus('屏幕捕获已开始');

      stream.getVideoTracks()[0].onended = () => {
        setIsCapturing(false);
        setStatus('屏幕捕获已停止');
        streamRef.current = null;
        stopRecording();
        stopBroadcast();
      };
    } catch (error) {
      console.error('屏幕捕获失败:', error);
      setStatus('屏幕捕获失败: ' + error.message);
    }
  };

  const startBroadcast = () => {
    if (!streamRef.current) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    broadcastIntervalRef.current = setInterval(() => {
      if (video && video.videoWidth > 0) {
        canvas.width = video.videoWidth / 2;
        canvas.height = video.videoHeight / 2;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.5);
        socketRef.current.emit('broadcast-frame', frame);
      }
    }, 100);
  };

  const stopBroadcast = () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
  };

  const joinViewMode = async (host) => {
    setSelectedHost(host);
    setMode('view');
    socketRef.current.emit('join-view', host.id);
    
    if (!streamRef.current) {
      await startScreenCapture();
    }
  };

  const connectToHost = async (host) => {
    const switchingHost = selectedHost !== null;
    
    if (peerConnectionRef.current) {
      cleanup(false);
    }

    setSelectedHost(host);
    setMode('control');
    setStatus(switchingHost ? '正在切换连接...' : '正在建立WebRTC连接...');

    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    if (!peerConnectionRef.current) {
      peerConnectionRef.current = new RTCPeerConnection(config);

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && selectedHost) {
          socketRef.current.emit('ice-candidate', {
            targetId: selectedHost.id,
            candidate: event.candidate
          });
        }
      };

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, streamRef.current);
        });
      }
    }

    dataChannelRef.current = peerConnectionRef.current.createDataChannel('input-events', {
      ordered: false,
      maxRetransmits: 0
    });

    dataChannelRef.current.binaryType = 'arraybuffer';

    dataChannelRef.current.onopen = () => {
      setStatus('DataChannel已打开，可以开始控制');
    };

    dataChannelRef.current.onclose = () => {
      setStatus('DataChannel已关闭');
      setIsConnected(false);
    };

    dataChannelRef.current.onerror = (error) => {
      console.error('DataChannel错误:', error);
    };

    const offer = await peerConnectionRef.current.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });

    await peerConnectionRef.current.setLocalDescription(offer);

    socketRef.current.emit('offer', {
      targetId: host.id,
      offer: offer
    });

    setStatus('已发送Offer，等待Answer...');
  };

  const sendInputEvent = useCallback((event) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (mode !== 'control') return;
    
    const now = Date.now();
    if (now - lastMouseSendRef.current < 16) return;
    lastMouseSendRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * window.screen.width);
    const y = Math.round((e.clientY - rect.top) / rect.height * window.screen.height);
    sendInputEvent({ type: 'mousemove', x, y });
  }, [sendInputEvent, mode]);

  const handleMouseDown = useCallback((e) => {
    if (mode !== 'control') return;
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    sendInputEvent({ type: 'mousedown', button });
  }, [sendInputEvent, mode]);

  const handleMouseUp = useCallback((e) => {
    if (mode !== 'control') return;
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    sendInputEvent({ type: 'mouseup', button });
  }, [sendInputEvent, mode]);

  const handleWheel = useCallback((e) => {
    if (mode !== 'control') return;
    e.preventDefault();
    const dx = Math.sign(e.deltaX) * 10;
    const dy = Math.sign(e.deltaY) * 10;
    sendInputEvent({ type: 'scroll', dx, dy });
  }, [sendInputEvent, mode]);

  const handleKeyDown = useCallback((e) => {
    if (mode !== 'control') return;
    e.preventDefault();
    const key = e.key.toLowerCase();
    if (key.length === 1 || ['enter', 'backspace', 'tab', 'escape', 'space',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'control', 'ctrl', 'alt', 'shift', 'meta'].includes(key)) {
      sendInputEvent({ type: 'keydown', key: key.replace('arrow', '') });
    }
  }, [sendInputEvent, mode]);

  const handleKeyUp = useCallback((e) => {
    if (mode !== 'control') return;
    e.preventDefault();
    const key = e.key.toLowerCase();
    if (key.length === 1 || ['enter', 'backspace', 'tab', 'escape', 'space',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'control', 'ctrl', 'alt', 'shift', 'meta'].includes(key)) {
      sendInputEvent({ type: 'keyup', key: key.replace('arrow', '') });
    }
  }, [sendInputEvent, mode]);

  const sendClipboardText = () => {
    if (selectedHost && clipboardText) {
      socketRef.current.emit('clipboard-data', {
        targetId: selectedHost.id,
        type: 'text',
        content: clipboardText
      });
      setStatus('已发送文本到远程剪贴板');
      setClipboardText('');
      setShowClipboardModal(false);
    }
  };

  const sendClipboardImage = (e) => {
    const file = e.target.files[0];
    if (file && selectedHost) {
      const reader = new FileReader();
      reader.onload = (event) => {
        socketRef.current.emit('clipboard-data', {
          targetId: selectedHost.id,
          type: 'image',
          content: event.target.result
        });
        setStatus('已发送图片到远程剪贴板');
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setStatus('请先开始屏幕捕获');
      return;
    }
    
    const options = { mimeType: 'video/webm;codecs=vp9' };
    setRecordedChunks([]);
    
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        setStatus('录制已完成');
      };
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setStatus('正在录制...');
    } catch (error) {
      console.error('启动录制失败:', error);
      setStatus('录制启动失败');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;
    
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screen-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('录制已下载');
  };

  const disconnect = useCallback(() => {
    if (selectedHost) {
      socketRef.current.emit('leave-view', selectedHost.id);
      socketRef.current.emit('release-control', selectedHost.id);
    }
    stopBroadcast();
    cleanup(true);
    setStatus('已断开连接');
  }, [cleanup, selectedHost]);

  return (
    <div className="app">
      <header className="header">
        <h1>WebRTC 远程控制</h1>
        <div className="status">{status}</div>
        <div className="header-actions">
          {isCapturing && (
            <>
              <button 
                className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? '⏹ 停止录制' : '⏺ 开始录制'}
              </button>
              {recordedChunks.length > 0 && (
                <button className="btn btn-primary" onClick={downloadRecording}>
                  ⬇ 下载录制
                </button>
              )}
            </>
          )}
          {isConnected && (
            <button className="btn btn-clipboard" onClick={() => setShowClipboardModal(true)}>
              📋 剪贴板
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="control-panel">
            <h2>控制面板</h2>
            <button
              className={`btn ${isCapturing ? 'btn-secondary' : 'btn-primary'}`}
              onClick={startScreenCapture}
              disabled={isCapturing}
            >
              {isCapturing ? '✓ 已捕获屏幕' : '开始屏幕捕获'}
            </button>
          </div>

          <div className="host-list">
            <h2>在线主机</h2>
            {hosts.length === 0 ? (
              <p className="no-hosts">暂无在线主机</p>
            ) : (
              <ul>
                {hosts.map((host) => (
                  <li
                    key={host.id}
                    className={`host-item ${selectedHost?.id === host.id ? 'selected' : ''}`}
                  >
                    <div className="host-name">{host.name}</div>
                    <div className="host-info">
                      <span className="host-os">{host.os}</span>
                      <span className="host-viewers">👁 {host.viewerCount}</span>
                    </div>
                    <div className="host-actions">
                      <button 
                        className="btn btn-small btn-view"
                        onClick={() => joinViewMode(host)}
                      >
                        观看
                      </button>
                      <button 
                        className={`btn btn-small ${host.hasController ? 'btn-disabled' : 'btn-control'}`}
                        onClick={() => connectToHost(host)}
                        disabled={host.hasController}
                      >
                        {host.hasController ? '被占用' : '控制'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedHost && (
            <div className="connection-info">
              <h3>当前连接</h3>
              <p>主机: {selectedHost.name}</p>
              <p>模式: {mode === 'view' ? '仅观看' : '控制'}</p>
              <button className="btn btn-danger" onClick={disconnect}>
                断开连接
              </button>
            </div>
          )}
        </aside>

        <main className="content">
          <div
            className="video-container"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            tabIndex={0}
          >
            {mode === 'view' ? (
              <canvas ref={canvasRef} className="remote-video" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="remote-video"
              />
            )}
            {!isCapturing && (
              <div className="video-placeholder">
                <p>请先点击"开始屏幕捕获"按钮</p>
              </div>
            )}
            {isRecording && (
              <div className="recording-indicator">
                <span className="recording-dot"></span>
                正在录制
              </div>
            )}
          </div>

          {showInstructions && (
            <div className="instructions">
              <div className="instructions-header">
                <h3>使用说明</h3>
                <button className="btn-close" onClick={() => setShowInstructions(false)}>×</button>
              </div>
              <ol>
                <li><strong>屏幕捕获:</strong> 点击"开始屏幕捕获"选择要共享的屏幕</li>
                <li><strong>观看模式:</strong> 点击"观看"仅查看屏幕，不控制远程主机</li>
                <li><strong>控制模式:</strong> 点击"控制"获得远程主机的鼠标键盘控制权</li>
                <li><strong>剪贴板共享:</strong> 点击顶部"📋 剪贴板"按钮发送文本或图片到远程剪贴板</li>
                <li><strong>屏幕录制:</strong> 点击"开始录制"录制屏幕，结束后可下载</li>
                <li><strong>多用户同步:</strong> 支持多个用户同时观看同一主机的屏幕</li>
              </ol>
            </div>
          )}
        </main>
      </div>

      {showClipboardModal && (
        <div className="modal-overlay" onClick={() => setShowClipboardModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>剪贴板共享</h3>
            <div className="form-group">
              <label>文本内容:</label>
              <textarea
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder="输入要发送的文本..."
                rows={4}
              />
              <button className="btn btn-primary" onClick={sendClipboardText}>
                发送文本
              </button>
            </div>
            <div className="form-group">
              <label>图片内容:</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={sendClipboardImage}
              />
              <p className="hint">支持 PNG、JPG 格式</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowClipboardModal(false)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
