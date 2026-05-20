import React from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import TemplateLibrary from './TemplateLibrary';
import './Toolbar.css';

const Toolbar = () => {
  const {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    brushSize,
    setBrushSize,
    undo,
    redo,
    isRecording,
    startRecording,
    stopRecording,
    playRecording,
    isPlaying,
    exportSVG,
    exportPDF
  } = useWhiteboard();

  const colors = [
    '#000000', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ff8800',
    '#8800ff', '#88ff00', '#0088ff', '#ff0088'
  ];

  const tools = [
    { id: 'select', name: '选择', icon: '👆' },
    { id: 'pen', name: '画笔', icon: '✏️' },
    { id: 'rect', name: '矩形', icon: '⬜' },
    { id: 'circle', name: '圆形', icon: '⭕' },
    { id: 'line', name: '直线', icon: '➖' },
    { id: 'text', name: '文字', icon: 'T' },
    { id: 'eraser', name: '橡皮', icon: '🧽' }
  ];

  return (
    <div className="toolbar">
      <div className="tool-section">
        <span className="section-title">工具</span>
        <div className="tools-grid">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className={`tool-btn ${currentTool === tool.id ? 'active' : ''}`}
              onClick={() => setCurrentTool(tool.id)}
              title={tool.name}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">颜色</span>
        <div className="colors-grid">
          {colors.map((color) => (
            <button
              key={color}
              className={`color-btn ${currentColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setCurrentColor(color)}
            />
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">画笔大小: {brushSize}px</span>
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value))}
          className="size-slider"
        />
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">操作</span>
        <div className="action-buttons">
          <button className="action-btn" onClick={undo} title="撤销">
            ↩️
          </button>
          <button className="action-btn" onClick={redo} title="重做">
            ↪️
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">录制</span>
        <div className="record-buttons">
          {!isRecording ? (
            <button
              className="record-btn start"
              onClick={startRecording}
              disabled={isPlaying}
            >
              🔴 开始录制
            </button>
          ) : (
            <button className="record-btn stop" onClick={stopRecording}>
              ⬛ 停止录制
            </button>
          )}
          <button
            className="play-btn"
            onClick={playRecording}
            disabled={isRecording || isPlaying}
          >
            ▶️ 播放
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">模板</span>
        <TemplateLibrary />
      </div>

      <div className="divider" />

      <div className="tool-section">
        <span className="section-title">导出</span>
        <div className="export-buttons">
          <button className="export-btn svg" onClick={exportSVG}>
            📄 SVG
          </button>
          <button className="export-btn pdf" onClick={exportPDF}>
            📑 PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
