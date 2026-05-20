import { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasRenderer } from '@/canvas/Renderer';
import { PhysicsEngine } from '@/physics/PhysicsEngine';
import { useGameStore } from '@/store/useGameStore';
import { WaterWheel, Gear, LoadObject, LoadType } from '@/types';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const animationRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const {
    objects,
    waterLevel,
    selectedTool,
    selectedObjectId,
    setSelectedObject,
    addObject,
    removeObject,
    updateObject,
    isPlaying,
    setTotalPowerOutput,
    currentUser,
    selectedLoadType,
  } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      if (rendererRef.current) {
        rendererRef.current.resize(canvas.width, canvas.height);
      }
      if (physicsRef.current) {
        physicsRef.current.updateSize(canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new CanvasRenderer(ctx, canvas.width, canvas.height);
    physicsRef.current = new PhysicsEngine(canvas.width, canvas.height);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      if (rendererRef.current && physicsRef.current) {
        const smoothedWaterLevel = PhysicsEngine.smoothWaterLevel(waterLevel);

        const physicsResult = physicsRef.current.update(objects, smoothedWaterLevel, deltaTime, isPlaying);

        useGameStore.setState({
          objects: physicsResult.objects,
          waterLevel: physicsResult.waterLevel,
        });

        setTotalPowerOutput(physicsResult.totalPower);

        rendererRef.current.render(physicsResult.objects, smoothedWaterLevel, selectedObjectId);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [objects, waterLevel, selectedObjectId, isPlaying, setTotalPowerOutput]);

  const getCanvasPosition = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPosition(e);

    if (selectedTool === 'select') {
      const clickedObject = rendererRef.current?.getObjectAtPoint(pos.x, pos.y, objects);
      if (clickedObject) {
        setSelectedObject(clickedObject.id);
        setIsDragging(true);
        setDragOffset({
          x: pos.x - clickedObject.x,
          y: pos.y - clickedObject.y,
        });
      } else {
        setSelectedObject(null);
      }
    } else if (selectedTool === 'waterwheel') {
      const newWheel: WaterWheel = {
        id: `wheel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        type: 'waterwheel',
        radius: 80,
        bladeCount: 8,
        angularVelocity: 0,
        angularAcceleration: 0,
        material: 'wood',
        durability: 100,
        maxDurability: 100,
        creatorId: currentUser.id,
      };
      addObject(newWheel);
      setSelectedObject(newWheel.id);
    } else if (selectedTool === 'gear') {
      const newGear: Gear = {
        id: `gear-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        type: 'gear',
        radius: 50,
        teeth: 20,
        angularVelocity: 0,
        connectedTo: [],
        material: 'metal',
        durability: 200,
        maxDurability: 200,
        creatorId: currentUser.id,
      };
      addObject(newGear);
      setSelectedObject(newGear.id);
    } else if (selectedTool === 'load') {
      const newLoad: LoadObject = {
        id: `load-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        type: 'load',
        loadType: selectedLoadType,
        efficiency: 0.85,
        isRunning: false,
        connectedTo: null,
        output: 0,
        material: 'metal',
        durability: 200,
        maxDurability: 200,
        creatorId: currentUser.id,
      };
      addObject(newLoad);
      setSelectedObject(newLoad.id);
    } else if (selectedTool === 'delete') {
      const clickedObject = rendererRef.current?.getObjectAtPoint(pos.x, pos.y, objects);
      if (clickedObject) {
        removeObject(clickedObject.id);
      }
    }
  }, [selectedTool, objects, getCanvasPosition, addObject, removeObject, setSelectedObject, currentUser, selectedLoadType]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedObjectId) return;

    const pos = getCanvasPosition(e);
    updateObject(selectedObjectId, {
      x: pos.x - dragOffset.x,
      y: pos.y - dragOffset.y,
    });
  }, [isDragging, selectedObjectId, dragOffset, getCanvasPosition, updateObject]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
