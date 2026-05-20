import React, { useState, useEffect, useRef } from 'react';
import { GameManager } from './game/GameManager';
import { StatusPanel } from './components/StatusPanel';
import { MiniMap } from './components/MiniMap';
import { ControlsPanel } from './components/ControlsPanel';

export const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current) return;

    const gameManager = new GameManager('game-container');
    gameManagerRef.current = gameManager;

    gameManager.start()
      .then(() => setIsConnected(true))
      .catch((err) => {
        console.error('Failed to start game:', err);
        setError('无法连接到服务器，请确保后端服务已启动');
      });

    return () => {
      gameManager.stop();
    };
  }, []);

  return (
    <div style={appStyle}>
      <div ref={gameContainerRef} id="game-container" style={gameContainerStyle} />
      
      {isConnected && gameManagerRef.current && (
        <>
          <StatusPanel client={gameManagerRef.current.getClient()} />
          <MiniMap client={gameManagerRef.current.getClient()} />
          <ControlsPanel />
        </>
      )}

      {error && (
        <div style={errorStyle}>
          <h3 style={errorTitleStyle}>连接失败</h3>
          <p style={errorMessageStyle}>{error}</p>
          <p style={errorHintStyle}>请在 server 目录下运行 npm install && npm run dev</p>
        </div>
      )}

      {!isConnected && !error && (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          <p style={loadingTextStyle}>正在连接服务器...</p>
        </div>
      )}
    </div>
  );
};

const appStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative'
};

const gameContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%'
};

const errorStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(255, 50, 50, 0.9)',
  border: '2px solid #ff4444',
  borderRadius: 8,
  padding: 24,
  color: '#fff',
  fontFamily: "'Segoe UI', sans-serif",
  textAlign: 'center',
  maxWidth: 400
};

const errorTitleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 18
};

const errorMessageStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: 14
};

const errorHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  opacity: 0.8
};

const loadingStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  color: '#fff',
  fontFamily: "'Segoe UI', sans-serif"
};

const spinnerStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: '4px solid #4488ff33',
  borderTopColor: '#4488ff',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  margin: '0 auto 16px'
};

const loadingTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#aaa',
  margin: 0
};

const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
