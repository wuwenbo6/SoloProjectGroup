import React, { memo } from 'react';
import { Play, Pause, Square } from 'lucide-react';

const getSessionStatusText = (status) => {
  switch (status) {
    case 'running': return '运行中';
    case 'paused': return '已暂停';
    case 'stopped': return '已停止';
    case 'completed': return '已完成';
    default: return '空闲';
  }
};

const TranscriptionControl = ({ session, onStart, onPause, onStop }) => {
  const isRunning = session?.status === 'running';
  const isPaused = session?.status === 'paused';
  const hasActiveSession = session && session.status !== 'idle';

  return (
    <div className="transcription-progress">
      <div className="progress-header">
        <span className="progress-title">{session?.session_name || '当前转录任务'}</span>
        <span className="progress-percentage">{session?.progress?.toFixed(1) || 0}%</span>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${session?.progress || 0}%` }} 
        />
      </div>
      
      <div className="session-info">
        <div className="session-info-item">
          <label>当前帧</label>
          <value>{session?.current_frame || 0}</value>
        </div>
        <div className="session-info-item">
          <label>总帧数</label>
          <value>{session?.total_frames || 0}</value>
        </div>
        <div className="session-info-item">
          <label>状态</label>
          <value>{getSessionStatusText(session?.status)}</value>
        </div>
      </div>

      <div className="control-buttons">
        <button 
          className="control-btn start" 
          onClick={onStart}
          disabled={isRunning}
        >
          <Play size={18} />
          {isRunning ? '运行中' : '开始转录'}
        </button>
        <button 
          className="control-btn pause" 
          onClick={onPause}
          disabled={!isRunning || isPaused}
        >
          <Pause size={18} />
          暂停
        </button>
        <button 
          className="control-btn stop" 
          onClick={onStop}
          disabled={!hasActiveSession}
        >
          <Square size={18} />
          停止
        </button>
      </div>
    </div>
  );
};

export default memo(TranscriptionControl);
