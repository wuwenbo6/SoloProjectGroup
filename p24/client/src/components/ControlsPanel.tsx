import React from 'react';

export const ControlsPanel: React.FC = () => {
  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>操作说明</h3>
      <div style={controlsStyle}>
        <div style={controlItemStyle}>
          <kbd style={keyStyle}>W</kbd>
          <kbd style={keyStyle}>S</kbd>
          <span style={descStyle}>前进/后退</span>
        </div>
        <div style={controlItemStyle}>
          <kbd style={keyStyle}>A</kbd>
          <kbd style={keyStyle}>D</kbd>
          <span style={descStyle}>左转/右转</span>
        </div>
        <div style={controlItemStyle}>
          <kbd style={keyStyle}>M</kbd>
          <span style={descStyle}>采矿</span>
        </div>
        <div style={controlItemStyle}>
          <kbd style={keyStyle}>鼠标</kbd>
          <span style={descStyle}>射击</span>
        </div>
      </div>
    </div>
  );
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  left: 20,
  background: 'rgba(10, 10, 30, 0.9)',
  border: '2px solid #4488ff',
  borderRadius: 8,
  padding: 16,
  color: '#fff',
  fontFamily: "'Segoe UI', sans-serif"
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 14,
  color: '#4488ff',
  borderBottom: '1px solid #4488ff33',
  paddingBottom: 8
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8
};

const controlItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const keyStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid #4488ff55',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'monospace'
};

const descStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#aaa',
  marginLeft: 8
};
