import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, Hash, CheckCircle, XCircle } from 'lucide-react';

const CollectionProgress = ({ characters, sessionInfo }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const animationFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (sessionInfo?.isCollecting) {
      const updateTime = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current >= 1000) {
          const startTime = new Date(sessionInfo.startTime).getTime();
          setElapsedTime(Math.floor((now - startTime) / 1000));
          lastUpdateRef.current = now;
        }
        animationFrameRef.current = requestAnimationFrame(updateTime);
      };
      
      animationFrameRef.current = requestAnimationFrame(updateTime);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
    return () => {};
  }, [sessionInfo?.isCollecting, sessionInfo?.startTime]);

  const formatTime = React.useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const avgConfidence = useMemo(() => {
    if (characters.length === 0) return 0;
    const recentChars = characters.slice(-100);
    const sum = recentChars.reduce((acc, c) => acc + c.confidence, 0);
    return (sum / recentChars.length * 100).toFixed(1);
  }, [characters.length > 0 ? characters[characters.length - 1] : null]);

  const charCount = useMemo(() => characters.length, [characters.length]);

  return React.useMemo(() => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-dark mb-4">采集进度</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-primary/5 rounded-xl">
          <Hash className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold text-primary">{charCount}</div>
          <div className="text-sm text-dark-2">已采集字符</div>
        </div>
        <div className="text-center p-4 bg-success/5 rounded-xl">
          <Clock className="w-6 h-6 text-success mx-auto mb-2" />
          <div className="text-2xl font-bold text-success">{formatTime(elapsedTime)}</div>
          <div className="text-sm text-dark-2">采集时长</div>
        </div>
        <div className="text-center p-4 bg-warning/5 rounded-xl">
          <CheckCircle className="w-6 h-6 text-warning mx-auto mb-2" />
          <div className="text-2xl font-bold text-warning">{avgConfidence}%</div>
          <div className="text-sm text-dark-2">平均置信度</div>
        </div>
      </div>

      {sessionInfo?.isCollecting && (
        <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-primary font-medium">正在采集中...</span>
          <span className="text-sm text-dark-2">会话: {sessionInfo.sessionId?.slice(0, 8)}</span>
        </div>
      )}

      {!sessionInfo?.isCollecting && charCount === 0 && (
        <div className="text-center py-8 text-dark-2">
          <XCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无采集数据</p>
          <p className="text-sm">选择设备并开始采集</p>
        </div>
      )}
    </div>
  ), [elapsedTime, charCount, avgConfidence, sessionInfo, formatTime]);
};

export default CollectionProgress;