import React, { useRef, useEffect, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboard } from '../context/WhiteboardContext';
import './Whiteboard.css';

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef(null);
  const startPointRef = useRef(null);
  const selectedObjectRef = useRef(null);
  const originalPositionRef = useRef(null);
  
  const {
    setCanvas,
    currentTool,
    currentColor,
    brushSize,
    applyOperation,
    sendCursorPosition,
    users,
    userId
  } = useWhiteboard();

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true
    });

    fabricRef.current = canvas;
    setCanvas(canvas);

    canvas.on('selection:created', (e) => {
      if (e.selected && e.selected.length > 0) {
        selectedObjectRef.current = e.selected[0];
      }
    });

    canvas.on('selection:updated', (e) => {
      if (e.selected && e.selected.length > 0) {
        selectedObjectRef.current = e.selected[0];
      }
    });

    canvas.on('selection:cleared', () => {
      selectedObjectRef.current = null;
    });

    canvas.on('object:moving', (e) => {
      if (!originalPositionRef.current) {
        originalPositionRef.current = {
          left: e.target.left,
          top: e.target.top
        };
      }
    });

    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (!obj.id) {
        obj.id = uuidv4();
      }

      const props = {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
      };

      applyOperation({
        type: 'modify',
        data: { props },
        objectId: obj.id,
        isUndo: false
      }, true);

      originalPositionRef.current = null;
    });

    const handleResize = () => {
      if (containerRef.current && fabricRef.current) {
        fabricRef.current.setWidth(containerRef.current.clientWidth);
        fabricRef.current.setHeight(containerRef.current.clientHeight);
        fabricRef.current.renderAll();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, [setCanvas, applyOperation]);

  const handleMouseDown = useCallback((opt) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(opt.e);

    if (currentTool === 'select') {
      return;
    }

    isDrawingRef.current = true;
    startPointRef.current = pointer;

    switch (currentTool) {
      case 'pen': {
        const points = [pointer.x, pointer.y, pointer.x, pointer.y];
        const path = new fabric.Path(`M ${points[0]} ${points[1]} L ${points[2]} ${points[3]}`, {
          stroke: currentColor,
          strokeWidth: brushSize,
          fill: '',
          id: uuidv4(),
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          selectable: true
        });
        currentPathRef.current = path;
        canvas.add(path);
        break;
      }
      
      case 'rect': {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: '',
          stroke: currentColor,
          strokeWidth: brushSize,
          id: uuidv4(),
          selectable: true
        });
        currentPathRef.current = rect;
        canvas.add(rect);
        break;
      }
      
      case 'circle': {
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: '',
          stroke: currentColor,
          strokeWidth: brushSize,
          id: uuidv4(),
          selectable: true
        });
        currentPathRef.current = circle;
        canvas.add(circle);
        break;
      }
      
      case 'line': {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: currentColor,
          strokeWidth: brushSize,
          id: uuidv4(),
          selectable: true
        });
        currentPathRef.current = line;
        canvas.add(line);
        break;
      }
      
      case 'eraser': {
        canvas.set('isDrawingMode', true);
        canvas.freeDrawingBrush.width = brushSize * 2;
        canvas.freeDrawingBrush.color = '#ffffff';
        break;
      }
    }
  }, [currentTool, currentColor, brushSize]);

  const handleMouseMove = useCallback((opt) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(opt.e);
    
    sendCursorPosition(pointer.x, pointer.y);

    if (!isDrawingRef.current || !currentPathRef.current) return;

    switch (currentTool) {
      case 'pen': {
        const path = currentPathRef.current;
        path.path.push(['L', pointer.x, pointer.y]);
        path.set('path', path.path);
        canvas.renderAll();
        break;
      }
      
      case 'rect': {
        const rect = currentPathRef.current;
        rect.set({
          width: Math.abs(pointer.x - startPointRef.current.x),
          height: Math.abs(pointer.y - startPointRef.current.y),
          left: Math.min(pointer.x, startPointRef.current.x),
          top: Math.min(pointer.y, startPointRef.current.y)
        });
        canvas.renderAll();
        break;
      }
      
      case 'circle': {
        const circle = currentPathRef.current;
        const radius = Math.sqrt(
          Math.pow(pointer.x - startPointRef.current.x, 2) +
          Math.pow(pointer.y - startPointRef.current.y, 2)
        );
        circle.set({
          radius: radius,
          left: startPointRef.current.x - radius,
          top: startPointRef.current.y - radius
        });
        canvas.renderAll();
        break;
      }
      
      case 'line': {
        const line = currentPathRef.current;
        line.set({
          x2: pointer.x,
          y2: pointer.y
        });
        canvas.renderAll();
        break;
      }
    }
  }, [currentTool, sendCursorPosition]);

  const handleMouseUp = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentTool === 'eraser') {
      canvas.set('isDrawingMode', false);
      return;
    }

    if (currentPathRef.current) {
      const obj = currentPathRef.current;
      if (!obj.id) {
        obj.id = uuidv4();
      }

      applyOperation({
        type: 'add',
        data: { object: obj.toObject() },
        objectId: obj.id,
        isUndo: false
      }, true);
    }

    currentPathRef.current = null;
  }, [currentTool, applyOperation]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = useCallback((e) => {
    if (currentTool !== 'text') return;

    const canvas = fabricRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(e);
    const objectId = uuidv4();
    
    const text = new fabric.IText('输入文字', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Arial',
      fill: currentColor,
      fontSize: brushSize * 4,
      id: objectId,
      selectable: true
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    
    applyOperation({
      type: 'add',
      data: { object: text.toObject() },
      objectId,
      isUndo: false
    }, true);
  }, [currentTool, currentColor, brushSize, applyOperation]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (currentTool === 'select') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
    } else {
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, [currentTool]);

  return (
    <div className="whiteboard-container" ref={containerRef} onDoubleClick={handleDoubleClick}>
      <canvas ref={canvasRef} />
      
      {users.filter(u => u.userId !== userId).map((user) => (
        <div
          key={user.userId}
          id={`cursor-${user.userId}`}
          className="remote-cursor"
          style={{
            borderColor: user.color || '#ff0000'
          }}
        >
          <span style={{ background: user.color || '#ff0000' }}>
            {user.userName}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Whiteboard;
