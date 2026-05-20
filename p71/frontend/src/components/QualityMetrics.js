import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const QualityMetrics = ({ qualityParams, qualityHistory }) => {
  const latestQuality = qualityParams?.[qualityParams?.length - 1] || {};

  return (
    <div>
      <div className="quality-metrics">
        <div className="metric-item">
          <h4>分辨率</h4>
          <div className="value">{latestQuality.resolution || '4096x3112'}</div>
        </div>
        <div className="metric-item">
          <h4>码率</h4>
          <div className="value">{(latestQuality.bitrate / 1000000).toFixed(1) || 45} Mbps</div>
        </div>
        <div className="metric-item">
          <h4>帧率</h4>
          <div className="value">{latestQuality.fps || 24} fps</div>
        </div>
        <div className="metric-item">
          <h4>编码</h4>
          <div className="value">{latestQuality.codec || 'ProRes 4444'}</div>
        </div>
        <div className="metric-item">
          <h4>PSNR</h4>
          <div className="value">{latestQuality.psnr?.toFixed(2) || 42.5} dB</div>
        </div>
        <div className="metric-item">
          <h4>SSIM</h4>
          <div className="value">{latestQuality.ssim?.toFixed(4) || 0.9500}</div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={qualityHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={10} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(10, 25, 41, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff'
              }} 
            />
            <Line type="monotone" dataKey="psnr" stroke="#4caf50" strokeWidth={2} dot={false} name="PSNR" />
            <Line type="monotone" dataKey="ssim" stroke="#2196f3" strokeWidth={2} dot={false} name="SSIM" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default QualityMetrics;