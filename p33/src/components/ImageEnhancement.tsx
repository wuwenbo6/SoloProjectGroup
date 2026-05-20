import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/enhancement';

const watermarkPositions = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上角' },
  { value: 'center-left', label: '左侧居中' },
  { value: 'center', label: '居中' },
  { value: 'center-right', label: '右侧居中' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下角' },
];

const cropMethods = [
  { value: 'auto', label: '自动边缘检测' },
  { value: 'content-aware', label: '内容感知裁剪' },
];

const performanceModes = [
  { value: 'fast', label: '快速模式（低CPU占用）' },
  { value: 'balanced', label: '平衡模式' },
  { value: 'high_quality', label: '高质量模式' },
];

const ImageEnhancement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crop' | 'stitch' | 'watermark' | 'recognize'>('crop');
  const [loading, setLoading] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [stitchImages, setStitchImages] = useState<string[]>([]);
  const [recognitionResult, setRecognitionResult] = useState<any>(null);

  const [cropParams, setCropParams] = useState({
    method: 'auto',
    margin: 20,
    aspectRatio: undefined as number | undefined,
  });

  const [watermarkParams, setWatermarkParams] = useState({
    text: '',
    position: 'bottom-right',
    opacity: 0.3,
    scale: 0.2,
    font_size: 32,
    color: '#FFFFFF',
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImage(result);
        setResultImage(null);
        setRecognitionResult(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onDropStitch = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setStitchImages((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  const { getRootProps: getStitchRootProps, getInputProps: getStitchInputProps, isDragActive: isStitchDragActive } = useDropzone({
    onDrop: onDropStitch,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const handleCrop = async () => {
    if (!originalImage) return;
    setLoading(true);
    try {
      const base64Data = originalImage.split(',')[1];
      const response = await axios.post(`${API_BASE}/auto-crop`, {
        image_base64: base64Data,
        params: cropParams,
      });
      setResultImage(`data:image/jpeg;base64,${response.data.result}`);
    } catch (error) {
      console.error('裁剪失败:', error);
      alert('裁剪失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleStitch = async () => {
    if (stitchImages.length < 2) {
      alert('请至少上传2张图片进行拼接');
      return;
    }
    setLoading(true);
    try {
      const base64Images = stitchImages.map((img) => img.split(',')[1]);
      const response = await axios.post(`${API_BASE}/stitch`, {
        images_base64: base64Images,
        params: { blend_strength: 0.5, try_use_gpu: false },
      });
      setResultImage(`data:image/jpeg;base64,${response.data.result}`);
    } catch (error) {
      console.error('拼接失败:', error);
      alert('拼接失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleWatermark = async () => {
    if (!originalImage || !watermarkParams.text) {
      alert('请上传图片并输入水印文字');
      return;
    }
    setLoading(true);
    try {
      const base64Data = originalImage.split(',')[1];
      const response = await axios.post(`${API_BASE}/watermark/text`, {
        image_base64: base64Data,
        params: watermarkParams,
      });
      setResultImage(`data:image/jpeg;base64,${response.data.result}`);
    } catch (error) {
      console.error('添加水印失败:', error);
      alert('添加水印失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRecognize = async () => {
    if (!originalImage) return;
    setLoading(true);
    try {
      const base64Data = originalImage.split(',')[1];
      const response = await axios.post(`${API_BASE}/recognize-film-type`, {
        image_base64: base64Data,
      });
      setRecognitionResult(response.data);
    } catch (error) {
      console.error('识别失败:', error);
      alert('识别失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `enhanced_${Date.now()}.jpg`;
    link.click();
  };

  const clearAll = () => {
    setOriginalImage(null);
    setResultImage(null);
    setStitchImages([]);
    setRecognitionResult(null);
  };

  const renderCropTab = () => (
    <div className="card">
      <h3>智能裁剪</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
        <div>
          <h4>参数设置</h4>
          <div className="form-group">
            <label>裁剪方法</label>
            <select
              value={cropParams.method}
              onChange={(e) => setCropParams({ ...cropParams, method: e.target.value })}
            >
              {cropMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>边距: {cropParams.margin}px</label>
            <input
              type="range"
              min={0}
              max={100}
              value={cropParams.margin}
              onChange={(e) => setCropParams({ ...cropParams, margin: parseInt(e.target.value) })}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCrop} disabled={loading || !originalImage} style={{ marginTop: '1rem' }}>
            {loading ? '处理中...' : '开始裁剪'}
          </button>
        </div>
        <div>
          <h4>上传图片</h4>
          <div {...getRootProps()} style={{
            border: '2px dashed #666',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? '#1a1a2e' : 'transparent',
          }}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>拖放图片到这里...</p>
            ) : (
              <p>点击或拖放图片到这里上传</p>
            )}
          </div>
          {originalImage && (
            <div style={{ marginTop: '1rem' }}>
              <img src={originalImage} alt="原图" style={{ maxWidth: '100%', borderRadius: '4px' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStitchTab = () => (
    <div className="card">
      <h3>图片拼接</h3>
      <div style={{ marginTop: '1rem' }}>
        <div {...getStitchRootProps()} style={{
          border: '2px dashed #666',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isStitchDragActive ? '#1a1a2e' : 'transparent',
          marginBottom: '1rem',
        }}>
          <input {...getStitchInputProps()} />
          <p>点击或拖放多张图片到这里上传（至少2张）</p>
        </div>
        {stitchImages.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p>已上传 {stitchImages.length} 张图片</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {stitchImages.map((img, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={img} alt={`拼接图${idx + 1}`} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  <button
                    onClick={() => setStitchImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: '#ff4444',
                      border: 'none',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn-primary" onClick={handleStitch} disabled={loading || stitchImages.length < 2}>
          {loading ? '拼接中...' : '开始拼接'}
        </button>
      </div>
    </div>
  );

  const renderWatermarkTab = () => (
    <div className="card">
      <h3>批量水印</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
        <div>
          <h4>水印设置</h4>
          <div className="form-group">
            <label>水印文字</label>
            <input
              type="text"
              value={watermarkParams.text}
              onChange={(e) => setWatermarkParams({ ...watermarkParams, text: e.target.value })}
              placeholder="输入水印文字"
            />
          </div>
          <div className="form-group">
            <label>位置</label>
            <select
              value={watermarkParams.position}
              onChange={(e) => setWatermarkParams({ ...watermarkParams, position: e.target.value })}
            >
              {watermarkPositions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>不透明度: {(watermarkParams.opacity * 100).toFixed(0)}%</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={watermarkParams.opacity}
              onChange={(e) => setWatermarkParams({ ...watermarkParams, opacity: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>字体大小: {watermarkParams.font_size}px</label>
            <input
              type="range"
              min={12}
              max={72}
              value={watermarkParams.font_size}
              onChange={(e) => setWatermarkParams({ ...watermarkParams, font_size: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>文字颜色</label>
            <input
              type="color"
              value={watermarkParams.color}
              onChange={(e) => setWatermarkParams({ ...watermarkParams, color: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={handleWatermark} disabled={loading || !originalImage || !watermarkParams.text}>
            {loading ? '添加中...' : '添加水印'}
          </button>
        </div>
        <div>
          <h4>上传图片</h4>
          <div {...getRootProps()} style={{
            border: '2px dashed #666',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? '#1a1a2e' : 'transparent',
          }}>
            <input {...getInputProps()} />
            <p>点击或拖放图片到这里上传</p>
          </div>
          {originalImage && (
            <div style={{ marginTop: '1rem' }}>
              <img src={originalImage} alt="原图" style={{ maxWidth: '100%', borderRadius: '4px' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderRecognizeTab = () => (
    <div className="card">
      <h3>胶片类型自动识别</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
        <div>
          <div {...getRootProps()} style={{
            border: '2px dashed #666',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? '#1a1a2e' : 'transparent',
            marginBottom: '1rem',
          }}>
            <input {...getInputProps()} />
            <p>点击或拖放图片到这里上传</p>
          </div>
          <button className="btn btn-primary" onClick={handleRecognize} disabled={loading || !originalImage}>
            {loading ? '识别中...' : '开始识别'}
          </button>
        </div>
        <div>
          {originalImage && (
            <div>
              <h4>上传图片</h4>
              <img src={originalImage} alt="原图" style={{ maxWidth: '100%', borderRadius: '4px' }} />
            </div>
          )}
          {recognitionResult && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '4px' }}>
              <h4>识别结果</h4>
              <p><strong>胶片类型:</strong> {recognitionResult.film_type}</p>
              <p><strong>置信度:</strong> {(recognitionResult.confidence * 100).toFixed(1)}%</p>
              <h5 style={{ marginTop: '1rem' }}>图像特征:</h5>
              <ul style={{ fontSize: '0.9rem', color: '#aaa' }}>
                <li>亮度: {recognitionResult.characteristics?.brightness_mean?.toFixed(1)}</li>
                <li>对比度: {recognitionResult.characteristics?.contrast?.toFixed(2)}</li>
                <li>饱和度: {recognitionResult.characteristics?.saturation_mean?.toFixed(1)}</li>
                <li>颗粒度: {recognitionResult.characteristics?.grain_noise?.toFixed(2)}</li>
                <li>色调分布: {recognitionResult.characteristics?.tone_distribution}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="page-title">图像增强工具</h2>
      
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {(['crop', 'stitch', 'watermark', 'recognize'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              clearAll();
            }}
          >
            {tab === 'crop' ? '智能裁剪' : tab === 'stitch' ? '图片拼接' : tab === 'watermark' ? '批量水印' : '胶片识别'}
          </button>
        ))}
      </div>

      {activeTab === 'crop' && renderCropTab()}
      {activeTab === 'stitch' && renderStitchTab()}
      {activeTab === 'watermark' && renderWatermarkTab()}
      {activeTab === 'recognize' && renderRecognizeTab()}

      {resultImage && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>处理结果</h3>
            <button className="btn btn-primary" onClick={downloadResult}>下载图片</button>
          </div>
          <img src={resultImage} alt="处理结果" style={{ maxWidth: '100%', borderRadius: '4px' }} />
        </div>
      )}
    </div>
  );
};

export default ImageEnhancement;
