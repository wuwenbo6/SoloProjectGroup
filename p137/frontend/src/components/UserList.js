import React from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import './UserList.css';

const UserList = () => {
  const { users, userName, isAudioEnabled, isMuted, toggleAudio, toggleMute } = useWhiteboard();

  return (
    <div className="user-list">
      <div className="user-list-header">
        <span className="user-count">在线用户 ({users.length})</span>
      </div>
      
      <div className="voice-controls">
        <button
          className={`voice-btn ${isAudioEnabled ? 'enabled' : ''}`}
          onClick={toggleAudio}
          title={isAudioEnabled ? '关闭语音' : '开启语音'}
        >
          {isAudioEnabled ? '🔊' : '🔇'} 语音
        </button>
        {isAudioEnabled && (
          <button
            className={`mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
        )}
      </div>

      <div className="user-list-content">
        {users.map((user) => (
          <div
            key={user.userId}
            className={`user-item ${user.userName === userName ? 'current-user' : ''}`}
          >
            <div
              className="user-avatar"
              style={{ backgroundColor: user.color || '#667eea' }}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.userName}</span>
              {user.userName === userName && (
                <span className="user-badge">我</span>
              )}
              {user.speaking && (
                <span className="speaking-indicator">🎙️</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;
