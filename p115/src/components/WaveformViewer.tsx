import React, { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';

export const WaveformViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTrack, processedAudioData, currentTime, seek } = useAudioStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || processedAudioData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    const samples = processedAudioData[0];
    const samplesPerPixel = Math.floor(samples.length / width);
    
    ctx.fillStyle = '#3b82f6';
    
    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, samples.length);
      
      let max = 0;
      for (let j = start; j < end; j++) {
        max = Math.max(max, Math.abs(samples[j]));
      }
      
      const barHeight = max * centerY * 0.9;
      ctx.fillRect(i, centerY - barHeight, 1, barHeight * 2);
    }

    if (currentTrack && currentTrack.duration > 0) {
      const playheadX = (currentTime / currentTrack.duration) * width;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
  }, [processedAudioData, currentTime, currentTrack]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTrack) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * currentTrack.duration;
    seek(time);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white text-sm font-medium mb-2">波形显示</h3>
      <canvas
        ref={canvasRef}
        width={800}
        height={150}
        onClick={handleClick}
        className="w-full rounded cursor-pointer"
      />
      {processedAudioData.length === 0 && (
        <div className="text-gray-400 text-center py-8">
          录制或导入音频后显示波形
        </div>
      )}
    </div>
  );
};
