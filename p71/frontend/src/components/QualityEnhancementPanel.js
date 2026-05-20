import React, { useState, useEffect } from 'react';
import { Settings, Eye, RefreshCw } from 'lucide-react';

const QualityEnhancementPanel = ({ sessionId, api }) => {
  const [config, setConfig] = useState({
    sharpening: 0,
    denoising: 0,
    contrast: 1,
    brightness: 0,
    saturation: 1,
    color_correction: false,
    edge_enhancement: 0,
    is_preview_enabled: false,
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchConfig();
    }
  }, [sessionId]);

  const fetchConfig = async () => {
    try {
      const res = await api.get(`/sessions/${sessionId}/enhancement`);
      setConfig(res.data);
    } catch (e) {
      console.error('Failed to fetch enhancement config:', e);
    }
  };

  const updateConfig = async (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    try {
      await api.put(`/sessions/${sessionId}/enhancement`, newConfig);
    } catch (e) {
      console.error('Failed to update enhancement config:', e);
    }
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sessions/${sessionId}/preview`);
      setPreview(res.data);
    } catch (e) {
      console.error('Failed to fetch preview:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        <Settings size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <p>请先选择一个转录会话</p>
      </div>
    );
  }

  const sliders = [
    { key: 'sharpening', label: '锐化', min: 0, max: 10, step: 0.5 },
    { key: 'denoising', label: '降噪', min: 0, max: 10, step: 0.5 },
    { key: 'contrast', label: '对比度', min: 0.5, max: 2, step: 0.1 },
    { key: 'brightness', label: '亮度', min: -5, max: 5, step: 0.5 },
    { key: 'saturation', label: '饱和度', min: 0, max: 2, step: 0.1 },
    { key: 'edge_enhancement', label: '边缘增强', min: 0, max: 10, step: 0.5 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>画质增强设置</h3>
        <button
          onClick={fetchPreview}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'rgba(33, 150, 243, 0.2)',
            border: '1px solid rgba(33, 150, 243, 0.5)',
            borderRadius: '6px',
            color: '#90caf9',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
          }}
        >
          {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={14} />}
          预览效果
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {sliders.map(({ key, label, min, max, step }) => (
          <div key={key} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span>{label}</span>
              <span style={{ color: '#90caf9' }}>{config[key]}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={config[key]}
              onChange={(e) => updateConfig(key, parseFloat(e.target.value))}
              style={{ width: '100%', height: '6px', cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.color_correction}
            onChange={(e) => updateConfig('color_correction', e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <span style={{ fontSize: '13px' }}>启用色彩校正</span>
        </label>
      </div>

      {preview && (
        <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '10px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
          <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#90caf9' }}>
            帧 #{preview.frame_number} - 画质对比预览
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>原始画质</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#ff9800' }}>PSNR: {preview.original_quality.psnr.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>SSIM: {preview.original_quality.ssim.toFixed(4)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>增强后画质</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#4caf50' }}>PSNR: {preview.enhanced_quality.psnr.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>SSIM: {preview.enhanced_quality.ssim.toFixed(4)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>提升幅度</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#81c784' }}>+{preview.improvement.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityEnhancementPanel;
