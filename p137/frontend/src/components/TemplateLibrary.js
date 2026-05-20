import React, { useState } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import './TemplateLibrary.css';

const TemplateLibrary = () => {
  const { applyTemplate } = useWhiteboard();
  const [showLibrary, setShowLibrary] = useState(false);

  const templates = [
    {
      id: 'blank',
      name: '空白画板',
      description: '从零开始创作',
      icon: '⬜',
      objects: []
    },
    {
      id: 'flowchart',
      name: '流程图',
      description: '标准流程图模板',
      icon: '🔀',
      objects: [
        {
          type: 'rect',
          left: 100,
          top: 50,
          width: 120,
          height: 60,
          fill: '#ffffff',
          stroke: '#333333',
          strokeWidth: 2,
          name: '开始'
        },
        {
          type: 'rect',
          left: 100,
          top: 150,
          width: 120,
          height: 60,
          fill: '#e3f2fd',
          stroke: '#2196f3',
          strokeWidth: 2,
          name: '处理'
        },
        {
          type: 'rect',
          left: 100,
          top: 250,
          width: 120,
          height: 60,
          fill: '#fff3e0',
          stroke: '#ff9800',
          strokeWidth: 2,
          name: '判断'
        },
        {
          type: 'rect',
          left: 100,
          top: 350,
          width: 120,
          height: 60,
          fill: '#e8f5e9',
          stroke: '#4caf50',
          strokeWidth: 2,
          name: '结束'
        },
        {
          type: 'line',
          x1: 160, y1: 110, x2: 160, y2: 150,
          stroke: '#666666',
          strokeWidth: 2
        },
        {
          type: 'line',
          x1: 160, y1: 210, x2: 160, y2: 250,
          stroke: '#666666',
          strokeWidth: 2
        },
        {
          type: 'line',
          x1: 160, y1: 310, x2: 160, y2: 350,
          stroke: '#666666',
          strokeWidth: 2
        }
      ]
    },
    {
      id: 'uml-class',
      name: 'UML类图',
      description: 'UML类图模板',
      icon: '📊',
      objects: [
        {
          type: 'rect',
          left: 100,
          top: 50,
          width: 200,
          height: 30,
          fill: '#bbdefb',
          stroke: '#1976d2',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 100,
          top: 80,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#1976d2',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 100,
          top: 160,
          width: 200,
          height: 60,
          fill: '#ffffff',
          stroke: '#1976d2',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 400,
          top: 50,
          width: 200,
          height: 30,
          fill: '#c8e6c9',
          stroke: '#388e3c',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 400,
          top: 80,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#388e3c',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 400,
          top: 160,
          width: 200,
          height: 60,
          fill: '#ffffff',
          stroke: '#388e3c',
          strokeWidth: 2
        },
        {
          type: 'line',
          x1: 300, y1: 125, x2: 400, y2: 125,
          stroke: '#333333',
          strokeWidth: 2
        }
      ]
    },
    {
      id: 'mindmap',
      name: '思维导图',
      description: '中心辐射思维导图',
      icon: '🧠',
      objects: [
        {
          type: 'circle',
          left: 350,
          top: 200,
          radius: 50,
          fill: '#ffcdd2',
          stroke: '#c62828',
          strokeWidth: 3
        },
        {
          type: 'rect',
          left: 150,
          top: 100,
          width: 100,
          height: 40,
          fill: '#c8e6c9',
          stroke: '#388e3c',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 150,
          top: 200,
          width: 100,
          height: 40,
          fill: '#bbdefb',
          stroke: '#1976d2',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 150,
          top: 300,
          width: 100,
          height: 40,
          fill: '#fff3e0',
          stroke: '#f57c00',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 500,
          top: 100,
          width: 100,
          height: 40,
          fill: '#e1bee7',
          stroke: '#7b1fa2',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 500,
          top: 200,
          width: 100,
          height: 40,
          fill: '#b2ebf2',
          stroke: '#0097a7',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 500,
          top: 300,
          width: 100,
          height: 40,
          fill: '#f0f4c3',
          stroke: '#afb42b',
          strokeWidth: 2
        },
        {
          type: 'line', x1: 300, y1: 120, x2: 350, y2: 200, stroke: '#666666', strokeWidth: 2
        },
        {
          type: 'line', x1: 250, y1: 220, x2: 350, y2: 200, stroke: '#666666', strokeWidth: 2
        },
        {
          type: 'line', x1: 250, y1: 320, x2: 350, y2: 200, stroke: '#666666', strokeWidth: 2
        },
        {
          type: 'line', x1: 400, y1: 120, x2: 350, y2: 200, stroke: '#666666', strokeWidth: 2
        },
        {
          type: 'line', x1: 500, y1: 220, x2: 400, y2: 200, stroke: '#666666', strokeWidth: 2
        },
        {
          type: 'line', x1: 500, y1: 320, x2: 400, y2: 200, stroke: '#666666', strokeWidth: 2
        }
      ]
    },
    {
      id: 'kanban',
      name: '看板',
      description: '项目管理看板',
      icon: '📋',
      objects: [
        {
          type: 'rect',
          left: 50,
          top: 30,
          width: 200,
          height: 50,
          fill: '#e8f5e9',
          stroke: '#4caf50',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 50,
          top: 80,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 50,
          top: 170,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 300,
          top: 30,
          width: 200,
          height: 50,
          fill: '#fff3e0',
          stroke: '#ff9800',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 300,
          top: 80,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 300,
          top: 170,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 550,
          top: 30,
          width: 200,
          height: 50,
          fill: '#e3f2fd',
          stroke: '#2196f3',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 550,
          top: 80,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        },
        {
          type: 'rect',
          left: 550,
          top: 170,
          width: 200,
          height: 80,
          fill: '#ffffff',
          stroke: '#e0e0e0',
          strokeWidth: 2
        }
      ]
    },
    {
      id: 'timeline',
      name: '时间轴',
      description: '项目时间线模板',
      icon: '📅',
      objects: [
        {
          type: 'line',
          x1: 50, y1: 200, x2: 750, y2: 200,
          stroke: '#2196f3',
          strokeWidth: 4
        },
        {
          type: 'circle', left: 100, top: 200, radius: 10,
          fill: '#f44336', stroke: '#c62828', strokeWidth: 2
        },
        {
          type: 'circle', left: 250, top: 200, radius: 10,
          fill: '#ff9800', stroke: '#ef6c00', strokeWidth: 2
        },
        {
          type: 'circle', left: 400, top: 200, radius: 10,
          fill: '#4caf50', stroke: '#2e7d32', strokeWidth: 2
        },
        {
          type: 'circle', left: 550, top: 200, radius: 10,
          fill: '#2196f3', stroke: '#1565c0', strokeWidth: 2
        },
        {
          type: 'circle', left: 700, top: 200, radius: 10,
          fill: '#9c27b0', stroke: '#6a1b9a', strokeWidth: 2
        },
        {
          type: 'rect', left: 60, top: 100, width: 80, height: 60,
          fill: '#ffebee', stroke: '#ef9a9a', strokeWidth: 2
        },
        {
          type: 'rect', left: 210, top: 240, width: 80, height: 60,
          fill: '#fff3e0', stroke: '#ffcc80', strokeWidth: 2
        },
        {
          type: 'rect', left: 360, top: 100, width: 80, height: 60,
          fill: '#e8f5e9', stroke: '#a5d6a7', strokeWidth: 2
        },
        {
          type: 'rect', left: 510, top: 240, width: 80, height: 60,
          fill: '#e3f2fd', stroke: '#90caf9', strokeWidth: 2
        },
        {
          type: 'rect', left: 660, top: 100, width: 80, height: 60,
          fill: '#f3e5f5', stroke: '#ce93d8', strokeWidth: 2
        }
      ]
    },
    {
      id: 'wireframe',
      name: '线框图',
      description: '网页线框图模板',
      icon: '📱',
      objects: [
        {
          type: 'rect', left: 100, top: 30, width: 600, height: 50,
          fill: '#f5f5f5', stroke: '#9e9e9e', strokeWidth: 2
        },
        {
          type: 'rect', left: 120, top: 40, width: 100, height: 30,
          fill: '#2196f3', stroke: '#1976d2', strokeWidth: 2
        },
        {
          type: 'rect', left: 100, top: 100, width: 150, height: 300,
          fill: '#fafafa', stroke: '#e0e0e0', strokeWidth: 2
        },
        {
          type: 'rect', left: 270, top: 100, width: 430, height: 200,
          fill: '#e3f2fd', stroke: '#bbdefb', strokeWidth: 2
        },
        {
          type: 'rect', left: 270, top: 320, width: 200, height: 80,
          fill: '#ffffff', stroke: '#e0e0e0', strokeWidth: 2
        },
        {
          type: 'rect', left: 500, top: 320, width: 200, height: 80,
          fill: '#ffffff', stroke: '#e0e0e0', strokeWidth: 2
        }
      ]
    }
  ];

  const handleApplyTemplate = (template) => {
    const fabricObjects = template.objects.map(obj => {
      const baseObj = {
        type: obj.type,
        left: obj.left,
        top: obj.top,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        selectable: true
      };

      if (obj.type === 'rect') {
        return { ...baseObj, width: obj.width, height: obj.height };
      } else if (obj.type === 'circle') {
        return { ...baseObj, radius: obj.radius };
      } else if (obj.type === 'line') {
        return { ...baseObj, x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
      }

      return baseObj;
    });

    applyTemplate(fabricObjects);
    setShowLibrary(false);
  };

  return (
    <div className="template-library">
      <button
        className="template-toggle-btn"
        onClick={() => setShowLibrary(!showLibrary)}
      >
        📐 模板库
      </button>

      {showLibrary && (
        <div className="template-modal">
          <div className="template-header">
            <h3>选择模板</h3>
            <button
              className="close-btn"
              onClick={() => setShowLibrary(false)}
            >
              ✕
            </button>
          </div>
          <div className="template-grid">
            {templates.map((template) => (
              <div
                key={template.id}
                className="template-card"
                onClick={() => handleApplyTemplate(template)}
              >
                <div className="template-icon">{template.icon}</div>
                <div className="template-info">
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateLibrary;
