import React, { useState, useEffect } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function SandboxPanel() {
  const { sandbox, selectedDevice, devices, enableSandbox, disableSandbox, setSandboxOverride, predictFailure, checkModelReady } = useDeviceStore();
  const [localParams, setLocalParams] = useState({ speed: 1, temperature: 35 });
  const [modelCheckInterval, setModelCheckInterval] = useState(null);
  const device = devices.get(selectedDevice);

  useEffect(() => {
    checkModelReady();
    const interval = setInterval(checkModelReady, 5000);
    setModelCheckInterval(interval);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (device) {
      setLocalParams({
        speed: device.speed || device.rotationSpeed || 1,
        temperature: device.temperature || 35
      });
    }
  }, [selectedDevice]);

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      default: return '#52c41a';
    }
  };

  const getRiskLabel = (level) => {
    switch (level) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      default: return '低风险';
    }
  };

  const handlePredict = () => {
    if (selectedDevice) {
      predictFailure(selectedDevice, localParams);
    }
  };

  const handleApply = () => {
    if (selectedDevice && sandbox.enabled) {
      setSandboxOverride(selectedDevice, localParams);
    }
  };

  const predictionChartData = sandbox.currentPrediction
    ? sandbox.currentPrediction.failureProbability.map((p, i) => ({
        time: `${(i + 1) * 10}s`,
        probability: p * 100
      }))
    : [];

  return (
    <div className="sandbox-panel">
      <div className="sandbox-header">
        <h3>🎮 数字沙盘</h3>
        <button
          className={`sandbox-toggle ${sandbox.enabled ? 'active' : ''}`}
          onClick={() => sandbox.enabled ? disableSandbox() : enableSandbox()}
        >
          {sandbox.enabled ? '✅ 沙盘已启用' : '▶ 启用沙盘'}
        </button>
      </div>

      {sandbox.enabled && selectedDevice ? (
        <div className="sandbox-content">
          <div className="sandbox-device-info">
            <h4>{device?.name || '选择设备'}</h4>
            <span className="device-type">{device?.type}</span>
          </div>

          <div className="parameter-controls">
            <div className="parameter-item">
              <label>
                速度倍率: <strong>{localParams.speed.toFixed(2)}x</strong>
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={localParams.speed}
                onChange={(e) => setLocalParams(p => ({ ...p, speed: parseFloat(e.target.value) }))}
              />
              <div className="range-labels">
                <span>0.5x</span>
                <span>正常</span>
                <span>2x</span>
              </div>
            </div>

            <div className="parameter-item">
              <label>
                目标温度: <strong>{localParams.temperature.toFixed(1)}°C</strong>
              </label>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={localParams.temperature}
                onChange={(e) => setLocalParams(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
              />
              <div className="range-labels">
                <span>20°C</span>
                <span>50°C</span>
                <span>80°C</span>
              </div>
            </div>

            <button className="apply-btn" onClick={handleApply}>
              🔧 应用参数到模拟
            </button>
          </div>

          {!sandbox.modelReady && (
            <div className="model-warmup-notice">
              <div className="warmup-spinner"></div>
              <div className="warmup-text">
                <h5>🧠 LSTM模型预热中</h5>
                <p>正在将1GB模型加载到内存，首次预测可能需要30-60秒...</p>
              </div>
            </div>
          )}

          {sandbox.error && (
            <div className="prediction-error">
              ⚠️ {sandbox.error}
            </div>
          )}

          <button
            className={`predict-btn ${sandbox.isPredicting ? 'loading' : ''} ${!sandbox.modelReady ? 'disabled' : ''}`}
            onClick={handlePredict}
            disabled={sandbox.isPredicting || !sandbox.modelReady}
          >
            {sandbox.isPredicting ? '⏳ LSTM异步推理中...' : '🔮 预测未来5分钟故障风险'}
          </button>

          {sandbox.currentPrediction && (
            <div className="prediction-result">
              <div className="risk-summary">
                <div
                  className="risk-indicator"
                  style={{ backgroundColor: getRiskColor(sandbox.currentPrediction.riskLevel) }}
                >
                  {getRiskLabel(sandbox.currentPrediction.riskLevel)}
                </div>
                <div className="probability-value">
                  {(sandbox.currentPrediction.finalProbability * 100).toFixed(1)}%
                  <span className="probability-label">5分钟后故障概率</span>
                </div>
              </div>

              <div className="confidence-bar">
                <span>预测置信度</span>
                <div className="confidence-progress">
                  <div
                    className="confidence-fill"
                    style={{ width: `${sandbox.currentPrediction.confidence * 100}%` }}
                  />
                </div>
                <span>{(sandbox.currentPrediction.confidence * 100).toFixed(0)}%</span>
              </div>

              <div className="impact-factors">
                <h5>影响因素分析</h5>
                <div className="factor-item">
                  <span>🌡️ 温度影响</span>
                  <span className={`factor-level ${sandbox.currentPrediction.impactFactors?.temperature}`}>
                    {sandbox.currentPrediction.impactFactors?.temperature === 'high' ? '高' :
                     sandbox.currentPrediction.impactFactors?.temperature === 'medium' ? '中' : '低'}
                  </span>
                </div>
                <div className="factor-item">
                  <span>⚡ 速度影响</span>
                  <span className={`factor-level ${sandbox.currentPrediction.impactFactors?.speed}`}>
                    {sandbox.currentPrediction.impactFactors?.speed === 'high' ? '高' :
                     sandbox.currentPrediction.impactFactors?.speed === 'medium' ? '中' : '低'}
                  </span>
                </div>
              </div>

              <div className="prediction-chart">
                <h5>📈 故障概率趋势 (5分钟)</h5>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={predictionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, '故障概率']} />
                    <ReferenceLine y={30} stroke="#faad14" strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#ff4d4f" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="probability"
                      stroke={getRiskColor(sandbox.currentPrediction.riskLevel)}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className={`recommendation ${sandbox.currentPrediction.recommendation?.level}`}>
                <h5>💡 {sandbox.currentPrediction.recommendation?.title}</h5>
                <ul>
                  {sandbox.currentPrediction.recommendation?.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : sandbox.enabled ? (
        <div className="sandbox-empty">
          <p>👆 请从设备列表中选择一台设备进行模拟</p>
        </div>
      ) : (
        <div className="sandbox-empty">
          <p>🔬 启用数字沙盘模式进行参数模拟和预测</p>
          <p className="hint">调整设备参数，LSTM模型将预测未来5分钟的故障概率</p>
        </div>
      )}

      <style jsx>{`
        .sandbox-panel {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px;
          margin: 12px -20px;
          color: white;
        }

        .sandbox-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .sandbox-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .sandbox-toggle {
          padding: 8px 16px;
          border: none;
          border-radius: 20px;
          background: rgba(255,255,255,0.2);
          color: white;
          cursor: pointer;
          transition: all 0.3s;
        }

        .sandbox-toggle.active {
          background: #52c41a;
        }

        .sandbox-device-info {
          background: rgba(255,255,255,0.1);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .sandbox-device-info h4 {
          margin: 0 0 4px;
          font-size: 14px;
        }

        .device-type {
          font-size: 12px;
          opacity: 0.8;
          text-transform: uppercase;
        }

        .parameter-controls {
          background: rgba(255,255,255,0.1);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .parameter-item {
          margin-bottom: 16px;
        }

        .parameter-item:last-child {
          margin-bottom: 0;
        }

        .parameter-item label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .parameter-item input[type="range"] {
          width: 100%;
          height: 6px;
          border-radius: 3px;
        }

        .range-labels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
        }

        .apply-btn, .predict-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 8px;
        }

        .apply-btn {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .apply-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .predict-btn {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }

        .predict-btn.loading {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .predict-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #666;
        }

        .model-warmup-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 193, 7, 0.2);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .warmup-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .warmup-text h5 {
          margin: 0 0 4px;
          font-size: 13px;
        }

        .warmup-text p {
          margin: 0;
          font-size: 11px;
          opacity: 0.8;
        }

        .prediction-error {
          padding: 12px;
          background: rgba(255, 77, 79, 0.2);
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .prediction-result {
          background: rgba(0,0,0,0.2);
          padding: 16px;
          border-radius: 8px;
          margin-top: 16px;
        }

        .risk-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .risk-indicator {
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
        }

        .probability-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }

        .probability-label {
          display: block;
          font-size: 11px;
          font-weight: 400;
          opacity: 0.8;
        }

        .confidence-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          font-size: 12px;
        }

        .confidence-progress {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: #52c41a;
          border-radius: 4px;
          transition: width 0.5s;
        }

        .impact-factors {
          margin-bottom: 16px;
        }

        .impact-factors h5 {
          margin: 0 0 8px;
          font-size: 12px;
          opacity: 0.9;
        }

        .factor-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 13px;
        }

        .factor-level.high { color: #ff4d4f; }
        .factor-level.medium { color: #faad14; }
        .factor-level.low { color: #52c41a; }

        .prediction-chart h5 {
          margin: 0 0 8px;
          font-size: 12px;
          opacity: 0.9;
        }

        .recommendation {
          margin-top: 16px;
          padding: 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
        }

        .recommendation h5 {
          margin: 0 0 8px;
          font-size: 13px;
        }

        .recommendation ul {
          margin: 0;
          padding-left: 18px;
          font-size: 12px;
          opacity: 0.9;
        }

        .recommendation li {
          margin-bottom: 4px;
        }

        .sandbox-empty {
          text-align: center;
          padding: 24px;
          opacity: 0.8;
        }

        .sandbox-empty p {
          margin: 0 0 8px;
        }

        .hint {
          font-size: 12px;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

export default SandboxPanel;
