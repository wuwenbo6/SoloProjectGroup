import React, { useEffect, useRef } from 'react';
import { WebSocketClient, GameEntity } from '../network/WebSocketClient';

interface MiniMapProps {
  client: WebSocketClient;
}

export const MiniMap: React.FC<MiniMapProps> = ({ client }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateMap = () => {
      const entities = client.getEntities();
      let playerX = 0;
      let playerY = 0;

      for (const entity of entities.values()) {
        if (entity.render?.type === 'ship' && entity.position) {
          playerX = entity.position.x;
          playerY = entity.position.y;
          break;
        }
      }

      ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = 0.05;
      const offsetX = canvas.width / 2;
      const offsetY = canvas.height / 2;

      for (const entity of entities.values()) {
        if (!entity.position || !entity.render) continue;

        const x = (entity.position.x - playerX) * scale + offsetX;
        const y = (entity.position.y - playerY) * scale + offsetY;

        if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) continue;

        let color = '#ffffff';
        let size = 3;

        switch (entity.render.type) {
          case 'ship':
            color = '#00ff88';
            size = 4;
            break;
          case 'asteroid':
            color = '#8B7355';
            size = 3;
            break;
          case 'station':
            color = '#4488ff';
            size = 6;
            break;
          case 'projectile':
            color = '#ff0000';
            size = 2;
            break;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const interval = setInterval(updateMap, 50);
    return () => clearInterval(interval);
  }, [client]);

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} width={150} height={150} style={canvasStyle} />
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 20,
  right: 20,
  background: 'rgba(10, 10, 30, 0.9)',
  border: '2px solid #4488ff',
  borderRadius: 8,
  padding: 8
};

const canvasStyle: React.CSSProperties = {
  display: 'block',
  borderRadius: 4
};
