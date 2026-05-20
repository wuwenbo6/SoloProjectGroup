import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Droplets, MapPin, Target, History, Trash2, Lock, Unlock } from 'lucide-react';
import { fabric } from 'fabric';
import { api } from '../services/api';
import { socket, joinMap } from '../services/socket';

function MapEditor({ currentUser }) {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [currentTool, setCurrentTool] = useState(null);
  const [controlPoints, setControlPoints] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [versions, setVersions] = useState([]);
  const [drawingPath, setDrawingPath] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotationName, setAnnotationName] = useState('');
  const [pendingControlPoint, setPendingControlPoint] = useState(null);
  const [lonInput, setLonInput] = useState('');
  const [latInput, setLatInput] = useState('');
  const [annotationLocks, setAnnotationLocks] = useState({});
  const [currentPathObject, setCurrentPathObject] = useState(null);

  const getPointerCoords = useCallback((e) => {
    if (!canvas) return { x: 0, y: 0 };
    const pointer = canvas.getPointer(e);
    return {
      x: pointer.x / zoom,
      y: pointer.y / zoom
    };
  }, [canvas, zoom]);

  useEffect(() => {
    loadMapData();
    joinMap(mapId, currentUser.id, currentUser.name);

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('active-users');
      socket.off('cursor-update');
      socket.off('annotation-added');
      socket.off('annotation-modified');
      socket.off('annotation-removed');
      socket.off('control-point-new');
      socket.off('annotation-locked');
      socket.off('annotation-unlocked');
    };
  }, [mapId, currentUser]);

  useEffect(() => {
    socket.on('user-joined', (user) => {
      console.log('用户加入:', user);
    });

    socket.on('user-left', (data) => {
      setActiveUsers(prev => prev.filter(u => u.id !== data.userId));
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[data.userId];
        return newCursors;
      });
      setAnnotationLocks(prev => {
        const newLocks = { ...prev };
        Object.keys(newLocks).forEach(key => {
          if (newLocks[key].userId === data.userId) {
            delete newLocks[key];
          }
        });
        return newLocks;
      });
    });

    socket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    socket.on('cursor-update', (data) => {
      if (data.userId !== currentUser.id) {
        setCursors(prev => ({
          ...prev,
          [data.userId]: { ...data, userName: data.userName || prev[data.userId]?.userName }
        }));
      }
    });

    socket.on('annotation-added', (annotation) => {
      setAnnotations(prev => {
        if (prev.some(a => a.id === annotation.id)) return prev;
        return [...prev, annotation];
      });
      renderAnnotation(annotation);
    });

    socket.on('annotation-modified', (annotation) => {
      setAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a));
      if (selectedAnnotation?.id === annotation.id) {
        refreshAnnotationOnCanvas(annotation);
      }
    });

    socket.on('annotation-removed', (data) => {
      setAnnotations(prev => prev.filter(a => a.id !== data.id));
      removeAnnotationFromCanvas(data.id);
    });

    socket.on('control-point-new', (point) => {
      setControlPoints(prev => {
        if (prev.some(p => p.id === point.id)) return prev;
        return [...prev, point];
      });
      renderControlPoint(point);
    });

    socket.on('annotation-locked', (data) => {
      if (data.userId !== currentUser.id) {
        setAnnotationLocks(prev => ({
          ...prev,
          [data.annotationId]: { userId: data.userId, userName: data.userName }
        }));
      }
    });

    socket.on('annotation-unlocked', (data) => {
      setAnnotationLocks(prev => {
        const newLocks = { ...prev };
        delete newLocks[data.annotationId];
        return newLocks;
      });
    });
  }, [currentUser.id, selectedAnnotation]);

  const loadMapData = async () => {
    try {
      const [map, points, annos] = await Promise.all([
        api.getMap(mapId),
        api.getControlPoints(mapId),
        api.getAnnotations(mapId)
      ]);
      
      setMapData(map);
      setControlPoints(points);
      setAnnotations(annos);
      
      initCanvas(map, points, annos);
    } catch (error) {
      console.error('加载地图数据失败:', error);
    }
  };

  const initCanvas = (map, points, annos) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: img.width,
        height: img.height,
        selection: true
      });

      const mapImage = new fabric.Image(img, {
        selectable: false,
        evented: false
      });
      fabricCanvas.add(mapImage);
      fabricCanvas.sendToBack(mapImage);

      points.forEach(point => renderControlPoint(point, fabricCanvas));
      annos.forEach(anno => renderAnnotation(anno, fabricCanvas));

      fabricCanvas.on('mouse:down', handleMouseDown);
      fabricCanvas.on('mouse:move', handleMouseMove);
      fabricCanvas.on('mouse:up', handleMouseUp);
      fabricCanvas.on('object:selected', handleObjectSelected);
      fabricCanvas.on('selection:cleared', handleSelectionCleared);

      setCanvas(fabricCanvas);

      if (!map.width || !map.height) {
        api.updateMapDimensions(mapId, img.width, img.height);
      }
    };
    img.src = map.url;
  };

  const renderControlPoint = (point, fabricCanvas = canvas) => {
    if (!fabricCanvas) return;
    
    const scaledX = point.x * zoom;
    const scaledY = point.y * zoom;
    
    const circle = new fabric.Circle({
      left: scaledX,
      top: scaledY,
      radius: 8 / zoom,
      fill: '#e74c3c',
      stroke: 'white',
      strokeWidth: 2 / zoom,
      selectable: false,
      originX: 'center',
      originY: 'center'
    });
    
    const text = new fabric.Text(`#${point.id}`, {
      left: scaledX,
      top: scaledY - 20 / zoom,
      fontSize: 12 / zoom,
      fill: 'white',
      backgroundColor: '#e74c3c',
      originX: 'center'
    });

    circle.pointId = point.id;
    circle.isControlPoint = true;
    circle.originalX = point.x;
    circle.originalY = point.y;
    
    fabricCanvas.add(circle, text);
    fabricCanvas.renderAll();
  };

  const renderAnnotation = (annotation, fabricCanvas = canvas) => {
    if (!fabricCanvas) return;
    
    let fabricObject;
    
    if (annotation.type === 'water') {
      const points = annotation.geometry.points;
      if (points && points.length > 1) {
        const pathPoints = points.map((p, i) => [
          i === 0 ? 'M' : 'L', p.x * zoom, p.y * zoom
        ]).flat();
        
        fabricObject = new fabric.Path(pathPoints, {
          stroke: '#3498db',
          strokeWidth: 3 / zoom,
          fill: 'rgba(52, 152, 219, 0.2)',
          selectable: true
        });
      }
    } else if (annotation.type === 'place') {
      const scaledX = annotation.geometry.x * zoom;
      const scaledY = annotation.geometry.y * zoom;
      
      fabricObject = new fabric.Group([
        new fabric.Circle({
          radius: 8 / zoom,
          fill: '#f39c12',
          stroke: 'white',
          strokeWidth: 2 / zoom,
          originX: 'center',
          originY: 'center'
        }),
        new fabric.Text(annotation.name || '', {
          fontSize: 14 / zoom,
          fill: '#2c3e50',
          left: 15 / zoom,
          top: -7 / zoom,
          backgroundColor: 'rgba(255,255,255,0.8)'
        })
      ], {
        left: scaledX,
        top: scaledY,
        selectable: true
      });
    }

    if (fabricObject) {
      fabricObject.annotationId = annotation.id;
      fabricObject.isAnnotation = true;
      fabricObject.annotationType = annotation.type;
      fabricCanvas.add(fabricObject);
      fabricCanvas.renderAll();
    }
  };

  const removeAnnotationFromCanvas = (annotationId, fabricCanvas = canvas) => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    objects.forEach(obj => {
      if (obj.isAnnotation && obj.annotationId === annotationId) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
  };

  const refreshAnnotationOnCanvas = (annotation, fabricCanvas = canvas) => {
    if (!fabricCanvas) return;
    removeAnnotationFromCanvas(annotation.id, fabricCanvas);
    renderAnnotation(annotation, fabricCanvas);
  };

  const handleMouseDown = (options) => {
    const coords = getPointerCoords(options.e);
    const pointer = canvas.getPointer(options.e);
    
    socket.emit('cursor-move', { mapId, x: coords.x, y: coords.y });

    if (currentTool === 'controlPoint') {
      setPendingControlPoint({ x: coords.x, y: coords.y });
      setLonInput('');
      setLatInput('');
    } else if (currentTool === 'water') {
      setIsDrawing(true);
      setDrawingPath([{ x: coords.x, y: coords.y }]);
      
      const path = new fabric.Path(`M ${pointer.x} ${pointer.y}`, {
        stroke: '#3498db',
        strokeWidth: 3 / zoom,
        fill: null,
        selectable: false
      });
      setCurrentPathObject(path);
      canvas.add(path);
    } else if (currentTool === 'place') {
      setPendingControlPoint({ x: coords.x, y: coords.y });
      setAnnotationName('');
    }
  };

  const handleMouseMove = (options) => {
    const coords = getPointerCoords(options.e);
    const pointer = canvas.getPointer(options.e);
    
    socket.emit('cursor-move', { mapId, x: coords.x, y: coords.y });

    if (isDrawing && drawingPath && currentPathObject) {
      const newPath = [...drawingPath, { x: coords.x, y: coords.y }];
      setDrawingPath(newPath);
      
      const pathPoints = newPath.map((p, i) => [
        i === 0 ? 'M' : 'L', p.x * zoom, p.y * zoom
      ]).flat();
      
      currentPathObject.path = pathPoints;
      canvas.renderAll();
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPathObject) {
      canvas.remove(currentPathObject);
      setCurrentPathObject(null);
    }
    if (isDrawing && drawingPath && drawingPath.length > 1) {
      setIsDrawing(false);
    }
  };

  const handleObjectSelected = (options) => {
    const obj = options.target;
    if (obj && obj.isAnnotation) {
      const annotationId = obj.annotationId;
      
      const lockInfo = annotationLocks[annotationId];
      if (lockInfo && lockInfo.userId !== currentUser.id) {
        canvas.deactivateAll();
        canvas.renderAll();
        alert(`此标注正被 ${lockInfo.userName} 编辑中`);
        return;
      }
      
      socket.emit('annotation-locked', {
        annotationId,
        userId: currentUser.id,
        userName: currentUser.name
      });
      
      setAnnotationLocks(prev => ({
        ...prev,
        [annotationId]: { userId: currentUser.id, userName: currentUser.name }
      }));
      
      const annotation = annotations.find(a => a.id === annotationId);
      setSelectedAnnotation(annotation);
      loadVersions(annotationId);
    }
  };

  const handleSelectionCleared = () => {
    if (selectedAnnotation) {
      socket.emit('annotation-unlocked', {
        annotationId: selectedAnnotation.id,
        userId: currentUser.id
      });
      
      setAnnotationLocks(prev => {
        const newLocks = { ...prev };
        delete newLocks[selectedAnnotation.id];
        return newLocks;
      });
    }
    setSelectedAnnotation(null);
    setVersions([]);
  };

  const loadVersions = async (annotationId) => {
    try {
      const data = await api.getAnnotationVersions(annotationId);
      setVersions(data);
    } catch (error) {
      console.error('加载版本失败:', error);
    }
  };

  const saveControlPoint = async () => {
    if (!pendingControlPoint || !lonInput || !latInput) return;
    
    try {
      const point = await api.addControlPoint(
        mapId,
        pendingControlPoint.x,
        pendingControlPoint.y,
        parseFloat(lonInput),
        parseFloat(latInput)
      );
      setPendingControlPoint(null);
      setLonInput('');
      setLatInput('');
    } catch (error) {
      console.error('保存控制点失败:', error);
    }
  };

  const savePlaceAnnotation = async () => {
    if (!pendingControlPoint) return;
    
    try {
      const annotation = await api.createAnnotation(
        mapId,
        'place',
        annotationName || '未命名地点',
        { x: pendingControlPoint.x, y: pendingControlPoint.y },
        null,
        currentUser.id
      );
      setPendingControlPoint(null);
      setAnnotationName('');
      setAnnotations(prev => [...prev, annotation]);
      renderAnnotation(annotation);
      socket.emit('annotation-created', annotation);
    } catch (error) {
      console.error('保存地点标注失败:', error);
    }
  };

  const saveWaterAnnotation = async () => {
    if (!drawingPath || drawingPath.length < 2) return;
    
    try {
      const annotation = await api.createAnnotation(
        mapId,
        'water',
        annotationName || '未命名水系',
        { points: drawingPath },
        null,
        currentUser.id
      );
      setDrawingPath(null);
      setAnnotationName('');
      setAnnotations(prev => [...prev, annotation]);
      renderAnnotation(annotation);
      socket.emit('annotation-created', annotation);
    } catch (error) {
      console.error('保存水系标注失败:', error);
    }
  };

  const deleteControlPoint = async (pointId) => {
    try {
      await api.deleteControlPoint(mapId, pointId);
      setControlPoints(prev => prev.filter(p => p.id !== pointId));
      
      if (canvas) {
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          if (obj.isControlPoint && obj.pointId === pointId) {
            canvas.remove(obj);
          }
        });
        
        objects.forEach(obj => {
          if (obj.type === 'text' && obj.text === `#${pointId}`) {
            canvas.remove(obj);
          }
        });
        
        canvas.renderAll();
      }
    } catch (error) {
      console.error('删除控制点失败:', error);
    }
  };

  const restoreVersion = async (version) => {
    if (!selectedAnnotation) return;
    
    const lockInfo = annotationLocks[selectedAnnotation.id];
    if (lockInfo && lockInfo.userId !== currentUser.id) {
      alert(`此标注正被 ${lockInfo.userName} 编辑中，无法恢复版本`);
      return;
    }
    
    try {
      const restored = await api.restoreVersion(selectedAnnotation.id, version.version);
      
      setAnnotations(prev => prev.map(a => a.id === restored.id ? restored : a));
      
      refreshAnnotationOnCanvas(restored);
      
      socket.emit('annotation-modified', restored);
      
      await loadVersions(restored.id);
      
    } catch (error) {
      console.error('恢复版本失败:', error);
      alert('恢复版本失败，请重试');
    }
  };

  const redrawAllAnnotations = useCallback((newZoom) => {
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.isControlPoint) {
        const scaledX = obj.originalX * newZoom;
        const scaledY = obj.originalY * newZoom;
        obj.set({
          left: scaledX,
          top: scaledY,
          radius: 8 / newZoom,
          strokeWidth: 2 / newZoom
        });
        obj.setCoords();
      } else if (obj.isAnnotation) {
        canvas.remove(obj);
      }
    });
    
    annotations.forEach(anno => {
      if (anno.type === 'water') {
        const points = anno.geometry.points;
        if (points && points.length > 1) {
          const pathPoints = points.map((p, i) => [
            i === 0 ? 'M' : 'L', p.x * newZoom, p.y * newZoom
          ]).flat();
          
          const fabricObject = new fabric.Path(pathPoints, {
            stroke: '#3498db',
            strokeWidth: 3 / newZoom,
            fill: 'rgba(52, 152, 219, 0.2)',
            selectable: true
          });
          fabricObject.annotationId = anno.id;
          fabricObject.isAnnotation = true;
          fabricObject.annotationType = anno.type;
          canvas.add(fabricObject);
        }
      } else if (anno.type === 'place') {
        const scaledX = anno.geometry.x * newZoom;
        const scaledY = anno.geometry.y * newZoom;
        
        const fabricObject = new fabric.Group([
          new fabric.Circle({
            radius: 8 / newZoom,
            fill: '#f39c12',
            stroke: 'white',
            strokeWidth: 2 / newZoom,
            originX: 'center',
            originY: 'center'
          }),
          new fabric.Text(anno.name || '', {
            fontSize: 14 / newZoom,
            fill: '#2c3e50',
            left: 15 / newZoom,
            top: -7 / newZoom,
            backgroundColor: 'rgba(255,255,255,0.8)'
          })
        ], {
          left: scaledX,
          top: scaledY,
          selectable: true
        });
        fabricObject.annotationId = anno.id;
        fabricObject.isAnnotation = true;
        fabricObject.annotationType = anno.type;
        canvas.add(fabricObject);
      }
    });
    
    canvas.renderAll();
  }, [canvas, annotations]);

  const handleZoomIn = () => {
    if (canvas) {
      const newZoom = Math.min(zoom * 1.2, 3);
      canvas.setZoom(newZoom);
      canvas.setWidth(mapData.width * newZoom);
      canvas.setHeight(mapData.height * newZoom);
      setZoom(newZoom);
      redrawAllAnnotations(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (canvas) {
      const newZoom = Math.max(zoom / 1.2, 0.3);
      canvas.setZoom(newZoom);
      canvas.setWidth(mapData.width * newZoom);
      canvas.setHeight(mapData.height * newZoom);
      setZoom(newZoom);
      redrawAllAnnotations(newZoom);
    }
  };

  if (!mapData) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="toolbar">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          返回
        </button>
        <span style={{ fontWeight: '600', fontSize: '14px' }}>{mapData.name}</span>
        
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomOut}>
            <ZoomOut size={18} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={handleZoomIn}>
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="active-users">
          {activeUsers.map(user => (
            <div
              key={user.id}
              className="user-avatar"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.slice(0, 2)}
            </div>
          ))}
        </div>
      </div>

      <div className="editor-layout">
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>标注工具</h3>
          </div>
          <div className="sidebar-content">
            <div className="tool-group">
              <div className="tool-group-title">坐标配准</div>
              <div className="tools">
                <button
                  className={`tool-btn ${currentTool === 'controlPoint' ? 'active' : ''}`}
                  onClick={() => setCurrentTool(currentTool === 'controlPoint' ? null : 'controlPoint')}
                >
                  <Target size={16} />
                  添加控制点
                </button>
              </div>

              {pendingControlPoint && currentTool === 'controlPoint' && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '13px', marginBottom: '8px' }}>
                    已选择点: ({Math.round(pendingControlPoint.x)}, {Math.round(pendingControlPoint.y)})
                  </p>
                  <div className="coord-input">
                    <input
                      type="text"
                      placeholder="经度"
                      value={lonInput}
                      onChange={(e) => setLonInput(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="纬度"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                    />
                  </div>
                  <button className="save-btn" onClick={saveControlPoint}>
                    保存控制点
                  </button>
                </div>
              )}

              {controlPoints.length > 0 && (
                <div className="control-point-list">
                  <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                    控制点 ({controlPoints.length})
                  </p>
                  {controlPoints.map(point => (
                    <div key={point.id} className="control-point-item">
                      <span>#{point.id}</span>
                      <span>{point.lon.toFixed(4)}, {point.lat.toFixed(4)}</span>
                      <button
                        className="delete-btn"
                        onClick={() => deleteControlPoint(point.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tool-group">
              <div className="tool-group-title">标注类型</div>
              <div className="tools">
                <button
                  className={`tool-btn ${currentTool === 'place' ? 'active' : ''}`}
                  onClick={() => setCurrentTool(currentTool === 'place' ? null : 'place')}
                >
                  <MapPin size={16} />
                  地名标注
                </button>
                <button
                  className={`tool-btn ${currentTool === 'water' ? 'active' : ''}`}
                  onClick={() => setCurrentTool(currentTool === 'water' ? null : 'water')}
                >
                  <Droplets size={16} />
                  水系标注
                </button>
              </div>

              {pendingControlPoint && currentTool === 'place' && (
                <div style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    placeholder="输入地名"
                    value={annotationName}
                    onChange={(e) => setAnnotationName(e.target.value)}
                    className="name-input"
                  />
                  <button className="save-btn" onClick={savePlaceAnnotation}>
                    保存地名
                  </button>
                </div>
              )}

              {drawingPath && currentTool === 'water' && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '13px', marginBottom: '8px' }}>
                    点数: {drawingPath.length}
                  </p>
                  <input
                    type="text"
                    placeholder="输入水系名称"
                    value={annotationName}
                    onChange={(e) => setAnnotationName(e.target.value)}
                    className="name-input"
                  />
                  <button className="save-btn" onClick={saveWaterAnnotation}>
                    保存水系
                  </button>
                </div>
              )}
            </div>

            <div className="tool-group">
              <div className="tool-group-title">标注列表</div>
              {annotations.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#7f8c8d' }}>暂无标注</p>
              ) : (
                annotations.map(anno => (
                  <div
                    key={anno.id}
                    className={`annotation-item ${selectedAnnotation?.id === anno.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAnnotation(anno)}
                    style={{
                      opacity: annotationLocks[anno.id] && annotationLocks[anno.id].userId !== currentUser.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="annotation-name">{anno.name}</div>
                      {annotationLocks[anno.id] && (
                        annotationLocks[anno.id].userId === currentUser.id ? 
                          <Unlock size={12} color="#27ae60" /> :
                          <Lock size={12} color="#e74c3c" />
                      )}
                    </div>
                    <div className="annotation-type">
                      {anno.type === 'water' ? '水系' : '地名'} · v{anno.version}
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedAnnotation && (
              <div className="tool-group">
                <div className="tool-group-title">
                  <History size={14} style={{ marginRight: '4px' }} />
                  版本历史
                </div>
                <div className="version-history">
                  {versions.map(ver => (
                    <div
                      key={ver.id}
                      className="version-item"
                      onClick={() => restoreVersion(ver)}
                    >
                      <div className="version-number">版本 {ver.version}</div>
                      <div className="version-date">{ver.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="canvas-container" ref={canvasWrapperRef}>
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} className="map-canvas" />
          </div>

          {Object.values(cursors).map(cursor => (
            <div
              key={cursor.userId}
              className="cursor-indicator"
              style={{
                left: cursor.x * zoom + (canvasWrapperRef.current?.scrollLeft || 0) + 40,
                top: cursor.y * zoom + (canvasWrapperRef.current?.scrollTop || 0) + 40
              }}
            >
              <div className="cursor-dot" style={{ backgroundColor: cursor.color }} />
              <div className="cursor-label">{cursor.userName}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MapEditor;
