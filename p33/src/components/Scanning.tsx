import React, { useState, useEffect, useRef } from 'react';
import { scanningAPI, paramsAPI } from '../services/api';

const Scanning: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(36);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [filmFormat, setFilmFormat] = useState('135');
  const [resolution, setResolution] = useState(2400);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [performanceMode, setPerformanceMode] = useState('balanced');
  const [frameSkip, setFrameSkip] = useState(0);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [params, setParams] = useState({
    brightness: 0,
    contrast: 1.0,
    saturation: 1.0,
    colorTemperature: 5500,
    sharpness: 1.0,
    noiseReduction: 50,
    scratchRemoval: true,
    fadeCorrection: true
  });
  const wsRef = useRef<WebSocket | null>(null);

  const loadRecentScans = async () => {
    try {
      const response = await scanningAPI.getRecentScans();
      setRecentScans(response.data.scans || []);
    } catch (error) {
      console.error('加载扫描记录失败:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const response = await paramsAPI.listProfiles();
      setProfiles(response.data || []);
    } catch (error) {
      console.error('加载参数配置失败:', error);
    }
  };

  useEffect(() => {
    loadRecentScans();
    loadProfiles();
  }, []);

  const handleProfileChange = async (profileId: number | null) => {
    setSelectedProfile(profileId);
    if (profileId) {
      try {
        const response = await paramsAPI.getProfile(profileId);
        const profile = response.data;
        setParams({
          brightness: profile.brightness || 0,
          contrast: profile.contrast || 1.0,
          saturation: profile.saturation || 1.0,
          colorTemperature: profile.color_temperature || 5500,
          sharpness: profile.sharpness || 1.0,
          noiseReduction: profile.noise_reduction || 50,
          scratchRemoval: profile.scratch_removal ?? true,
          fadeCorrection: profile.fade_correction ?? true
        });
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    }
  };

  const connectWebSocket = () => {
    wsRef.current = new WebSocket('ws://localhost:8000/ws/scanning');
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status) {
        setCurrentFrame(data.current_frame || 0);
        setTotalFrames(data.total_frames || 36);
        setProgress(data.progress || 0);
        if (data.current_image) {
          setPreviewImage(`data:image/jpeg;base64,${data.current_image}`);
        }
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const startScanning = async () => {
    try {
      await scanningAPI.startScan({
        resolution,
        film_format: filmFormat,
        frame_count: totalFrames,
        auto_exposure: true,
        profile_id: selectedProfile,
        performance_mode: performanceMode,
        frame_skip: frameSkip,
        low_power_mode: lowPowerMode,
        brightness: params.brightness,
        contrast: params.contrast,
        saturation: params.saturation,
        color_temperature: params.colorTemperature,
        sharpness: params.sharpness,
        noise_reduction: params.noiseReduction,
        scratch_removal: params.scratchRemoval,
        fade_correction: params.fadeCorrection
      });
      setIsScanning(true);
      setCurrentFrame(0);
      setProgress(0);
      connectWebSocket();
    } catch (error: any) {
      alert('开始扫描失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const stopScanning = async () => {
    try {
      await scanningAPI.stopScan();
      setIsScanning(false);
      if (wsRef.current) {
        wsRef.current.close();
      }
      await loadRecentScans();
    } catch (error: any) {
      alert('停止扫描失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const captureSingle = async () => {
    try {
      const response = await scanningAPI.captureSingle({
        brightness: params.brightness,
        contrast: params.contrast,
        saturation: params.saturation,
        color_temperature: params.colorTemperature,
        sharpness: params.sharpness,
        noise_reduction: params.noiseReduction
      });
      setPreviewImage(`data:image/jpeg;base64,${response.data.image}`);
      await loadRecentScans();
    } catch (error: any) {
      alert('捕获失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <h2 className="page-title">扫描转录</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3>实时预览</h3>
            <div style={{ 
              background: '#000', 
              borderRadius: '8px', 
              minHeight: '400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              {previewImage ? (
                <img src={previewImage} alt="预览" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px' }} />
              ) : (
                <p style={{ color: '#666' }}>等待开始扫描...</p>
              )}
            </div>

            {isScanning && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>扫描进度</span>
                  <span>{currentFrame} / {totalFrames} 帧 ({progress.toFixed(1)}%)</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              {!isScanning ? (
                <>
                  <button className="btn btn-primary" onClick={startScanning}>
                    开始批量扫描
                  </button>
                  <button className="btn btn-secondary" onClick={captureSingle}>
                    单帧捕获
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary" onClick={stopScanning} style={{ background: '#dc3545' }}>
                  停止扫描
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>扫描设置</h3>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>参数配置</label>
              <select 
                value={selectedProfile || ''} 
                onChange={e => handleProfileChange(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">默认配置</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>胶片格式</label>
              <select value={filmFormat} onChange={e => setFilmFormat(e.target.value)}>
                <option value="135">135胶片 (36张)</option>
                <option value="120">120胶片 (12张)</option>
              </select>
            </div>

            <div className="form-group">
              <label>扫描分辨率</label>
              <select value={resolution} onChange={e => setResolution(parseInt(e.target.value))}>
                <option value={1200}>1200 dpi</option>
                <option value={2400}>2400 dpi</option>
                <option value={3200}>3200 dpi</option>
                <option value={4800}>4800 dpi</option>
              </select>
            </div>

            <div className="form-group">
              <label>帧数量</label>
              <input 
                type="number" 
                value={totalFrames} 
                onChange={e => setTotalFrames(parseInt(e.target.value))}
                min={1}
                max={36}
              />
            </div>

            <div className="form-group">
              <label>性能模式</label>
              <select value={performanceMode} onChange={e => setPerformanceMode(e.target.value)}>
                <option value="fast">快速模式（速度优先）</option>
                <option value="balanced">平衡模式（推荐）</option>
                <option value="high_quality">高质量模式（质量优先）</option>
              </select>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={lowPowerMode}
                  onChange={e => setLowPowerMode(e.target.checked)}
                />
                低功耗模式（降低CPU占用）
              </label>
            </div>

            <div className="form-group">
              <label>帧跳过: {frameSkip}</label>
              <input
                type="range"
                className="slider"
                min={0}
                max={5}
                value={frameSkip}
                onChange={e => setFrameSkip(parseInt(e.target.value))}
              />
              <small style={{ color: '#666' }}>跳过N帧以提高速度（0=不跳过）</small>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ width: '100%' }}
              >
                {showAdvanced ? '隐藏高级设置' : '显示高级设置'} ▼
              </button>
            </div>

            {showAdvanced && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '4px' }}>
                <div className="form-group">
                  <label>亮度: {params.brightness}</label>
                  <input
                    type="range"
                    className="slider"
                    min={-100}
                    max={100}
                    value={params.brightness}
                    onChange={e => handleParamChange('brightness', parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>对比度: {params.contrast.toFixed(1)}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={params.contrast}
                    onChange={e => handleParamChange('contrast', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>饱和度: {params.saturation.toFixed(1)}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={3}
                    step={0.1}
                    value={params.saturation}
                    onChange={e => handleParamChange('saturation', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>色温: {params.colorTemperature}K</label>
                  <input
                    type="range"
                    className="slider"
                    min={2000}
                    max={10000}
                    step={100}
                    value={params.colorTemperature}
                    onChange={e => handleParamChange('colorTemperature', parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>锐化: {params.sharpness.toFixed(1)}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={3}
                    step={0.1}
                    value={params.sharpness}
                    onChange={e => handleParamChange('sharpness', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>降噪强度: {params.noiseReduction}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={100}
                    value={params.noiseReduction}
                    onChange={e => handleParamChange('noiseReduction', parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={params.scratchRemoval}
                      onChange={e => handleParamChange('scratchRemoval', e.target.checked)}
                    />
                    划痕修复
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={params.fadeCorrection}
                      onChange={e => handleParamChange('fadeCorrection', e.target.checked)}
                    />
                    褪色校正
                  </label>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '4px' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>预计信息</h4>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>
                性能模式: {performanceMode === 'fast' ? '快速' : performanceMode === 'high_quality' ? '高质量' : '平衡'}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>
                预计扫描时间: {(totalFrames * (performanceMode === 'fast' ? 1 : performanceMode === 'high_quality' ? 3 : 2) / (1 + frameSkip)).toFixed(0)} 秒
              </p>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>
                预计文件大小: {(totalFrames * 50 / (1 + frameSkip)).toFixed(0)} MB
              </p>
              {lowPowerMode && (
                <p style={{ fontSize: '0.9rem', color: '#4ade80' }}>
                  ⚡ 低功耗模式已启用
                </p>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>最近扫描</h3>
            {recentScans.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>
                暂无扫描记录
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
                {recentScans.slice(0, 5).map((scan, idx) => (
                  <div key={idx} style={{ padding: '0.5rem', background: '#1a1a2e', borderRadius: '4px', fontSize: '0.85rem' }}>
                    <p style={{ wordBreak: 'break-all' }}>{scan.filename}</p>
                    <p style={{ color: '#888' }}>{(scan.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scanning;
