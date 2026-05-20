import React, { useState, useEffect } from 'react';
import { WebSocketClient, GameEntity, Health, Cargo } from '../network/WebSocketClient';

interface StatusPanelProps {
  client: WebSocketClient;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ client }) => {
  const [health, setHealth] = useState<Health | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      const entities = client.getEntities();
      for (const entity of entities.values()) {
        if (entity.render?.type === 'ship') {
          if (entity.health) setHealth(entity.health);
          if (entity.cargo) setCargo(entity.cargo);
          break;
        }
      }
    };

    const interval = setInterval(updateStatus, 100);
    return () => clearInterval(interval);
  }, [client]);

  const healthPercent = health ? (health.current / health.max) * 100 : 0;
  const shieldPercent = health ? (health.shield / 200) * 100 : 0;

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>飞船状态</h3>
      
      <div style={statStyle}>
        <span style={labelStyle}>生命值</span>
        <div style={barContainerStyle}>
          <div style={{
            ...barStyle,
            width: `${healthPercent}%`,
            background: healthPercent > 50 ? '#00ff88' : healthPercent > 25 ? '#ffaa00' : '#ff4444'
          }} />
        </div>
        <span style={valueStyle}>{health?.current || 0}/{health?.max || 100}</span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>护盾</span>
        <div style={barContainerStyle}>
          <div style={{
            ...barStyle,
            width: `${shieldPercent}%`,
            background: '#4488ff'
          }} />
        </div>
        <span style={valueStyle}>{health?.shield || 0}</span>
      </div>

      <div style={cargoStyle}>
        <span style={labelStyle}>货舱 ({cargo ? Object.values(cargo.items).reduce((a, b) => a + b, 0) : 0}/{cargo?.capacity || 100})</span>
        <div style={cargoItemsStyle}>
          {cargo && Object.entries(cargo.items).map(([key, value]) => (
            <div key={key} style={cargoItemStyle}>
              <span style={resourceNameStyle}>{key}</span>
              <span style={resourceValueStyle}>{value}</span>
            </div>
          ))}
          {(!cargo || Object.keys(cargo.items).length === 0) && (
            <span style={emptyStyle}>空</span>
          )}
        </div>
      </div>
    </div>
  );
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 20,
  left: 20,
  background: 'rgba(10, 10, 30, 0.9)',
  border: '2px solid #4488ff',
  borderRadius: 8,
  padding: 16,
  minWidth: 200,
  color: '#fff',
  fontFamily: "'Segoe UI', sans-serif"
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 16,
  color: '#4488ff',
  borderBottom: '1px solid #4488ff33',
  paddingBottom: 8
};

const statStyle: React.CSSProperties = {
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#aaa',
  minWidth: 50
};

const barContainerStyle: React.CSSProperties = {
  flex: 1,
  height: 8,
  background: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 4,
  overflow: 'hidden'
};

const barStyle: React.CSSProperties = {
  height: '100%',
  transition: 'width 0.2s ease'
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  minWidth: 50,
  textAlign: 'right'
};

const cargoStyle: React.CSSProperties = {
  marginTop: 8
};

const cargoItemsStyle: React.CSSProperties = {
  marginTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4
};

const cargoItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  padding: '4px 8px',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 4
};

const resourceNameStyle: React.CSSProperties = {
  color: '#aaa'
};

const resourceValueStyle: React.CSSProperties = {
  color: '#00ff88'
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  textAlign: 'center',
  padding: 8
};
