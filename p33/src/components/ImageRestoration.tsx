import React, { useState } from 'react';
import { restorationAPI } from '../services/api';

interface RestorationParams {
  scratch_removal: boolean;
  scratch_radius: number;
  noise_reduction: boolean;
  noise_strength: number;
  fade_correction: boolean;
  color_enhance: number;
  contrast_enhance: number;
  sharpen: boolean;
  sharpen_amount: number;
}

const ImageRestoration: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [params, setParams] = useState<RestorationParams>({
    scratch_removal: true,
    scratch_radius: 3,
    noise_reduction: true,
    noise_strength: 50,
    fade_correction: true,
    color_enhance: 1.2,
    contrast_enhance: 1.1,
    sharpen: true,
    sharpen_amount: 1.0
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/api/restoration/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      setOriginalImage(`data:image/jpeg;base64,${result.image}`);
      setProcessedImage(null);
      setComparison(null);
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    }
  };

  const handleProcess = async () => {
    if (!originalImage) return;
    
    setProcessing(true);
    try {
      const base64Data = originalImage.split(',')[1];
      const response = await restorationAPI.process(base64Data, params);
      setProcessedImage(`data:image/png;base64,${response.data.result}`);
      
      const compResult = await restorationAPI.compare(base64Data, response.data.result);
      setComparison(compResult.data);
    } catch (error) {
      console.error('处理失败:', error);
      alert('处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickRestore = async () => {
    if (!originalImage) return;
    
    setProcessing(true);
    try {
      const base64Data = originalImage.split(',')[1];
      const response = await restorationAPI.quickRestore(base64Data);
      setProcessedImage(`data:image/png;base64,${response.data.result}`);
    } catch (error) {
      console.error('修复失败:', error);
      alert('修复失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleParamChange = (key: keyof RestorationParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const downloadProcessed = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'restored_image.png';
    link.click();
  };

  return (
    <div>
      <h2 className="page-title">图像降噪修复</h2>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          上传处理
        </button>
        <button 
          className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          高级设置
        </button>
      </div>

      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card">
            <h3>原图</h3>
            <div style={{ 
              background: '#000', 
              borderRadius: '8px', 
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              {originalImage ? (
                <img src={originalImage} alt="原图" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#666' }}>
                  <p>点击上传或拖放图片</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    style={{ marginTop: '1rem' }}
                  />
                </div>
              )}
            </div>
            
            {originalImage && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={handleQuickRestore} disabled={processing}>
                  一键修复
                </button>
                <button className="btn btn-secondary" onClick={handleProcess} disabled={processing}>
                  自定义修复
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>修复结果</h3>
            <div style={{ 
              background: '#000', 
              borderRadius: '8px', 
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              {processing ? (
                <p style={{ color: '#666' }}>处理中...</p>
              ) : processedImage ? (
                <img src={processedImage} alt="修复后" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }} />
              ) : (
                <p style={{ color: '#666' }}>等待处理...</p>
              )}
            </div>

            {processedImage && (
              <div>
                <button className="btn btn-primary" onClick={downloadProcessed}>
                  下载修复图片
                </button>
                {comparison && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '4px' }}>
                    <h4>修复统计</h4>
                    <p>变化率: {comparison.change_percentage.toFixed(2)}%</p>
                    <p>变化像素: {comparison.changed_pixels.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="card">
          <h3>高级修复参数</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
            <div>
              <h4 style={{ marginBottom: '1rem' }}>划痕修复</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={params.scratch_removal}
                    onChange={e => handleParamChange('scratch_removal', e.target.checked)}
                  />
                  启用划痕修复
                </label>
              </div>
              {params.scratch_removal && (
                <div className="form-group">
                  <label>修复半径: {params.scratch_radius}</label>
                  <input
                    type="range"
                    className="slider"
                    min={1}
                    max={10}
                    value={params.scratch_radius}
                    onChange={e => handleParamChange('scratch_radius', parseInt(e.target.value))}
                  />
                </div>
              )}

              <h4 style={{ margin: '1.5rem 0 1rem' }}>降噪处理</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={params.noise_reduction}
                    onChange={e => handleParamChange('noise_reduction', e.target.checked)}
                  />
                  启用降噪
                </label>
              </div>
              {params.noise_reduction && (
                <div className="form-group">
                  <label>降噪强度: {params.noise_strength}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={100}
                    value={params.noise_strength}
                    onChange={e => handleParamChange('noise_strength', parseInt(e.target.value))}
                  />
                </div>
              )}

              <h4 style={{ margin: '1.5rem 0 1rem' }}>褪色校正</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={params.fade_correction}
                    onChange={e => handleParamChange('fade_correction', e.target.checked)}
                  />
                  启用褪色校正
                </label>
              </div>
            </div>

            <div>
              <h4 style={{ marginBottom: '1rem' }}>色彩增强</h4>
              <div className="form-group">
                <label>色彩增强: {params.color_enhance.toFixed(1)}x</label>
                <input
                  type="range"
                  className="slider"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={params.color_enhance}
                  onChange={e => handleParamChange('color_enhance', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>对比度增强: {params.contrast_enhance.toFixed(1)}x</label>
                <input
                  type="range"
                  className="slider"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={params.contrast_enhance}
                  onChange={e => handleParamChange('contrast_enhance', parseFloat(e.target.value))}
                />
              </div>

              <h4 style={{ margin: '1.5rem 0 1rem' }}>锐化处理</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={params.sharpen}
                    onChange={e => handleParamChange('sharpen', e.target.checked)}
                  />
                  启用锐化
                </label>
              </div>
              {params.sharpen && (
                <div className="form-group">
                  <label>锐化强度: {params.sharpen_amount.toFixed(1)}</label>
                  <input
                    type="range"
                    className="slider"
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={params.sharpen_amount}
                    onChange={e => handleParamChange('sharpen_amount', parseFloat(e.target.value))}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageRestoration;
