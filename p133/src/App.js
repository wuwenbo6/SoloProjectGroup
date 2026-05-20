import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import RobotArm from './components/RobotArm';
import { Kinematics } from './utils/kinematics';
import { RRTStar } from './utils/rrtStar';
import { TeachRecorder, MultiArmManager, exportPathToJSON } from './utils/teachMode';
import './index.css';

function SceneContent({
  multiArmManager,
  targetPosition,
  obstacles,
  pathPoints,
  isPlanning,
  onTargetDrag,
  isDraggingTarget,
  collisions
}) {
  const mouseRef = useRef([0, 0]);
  
  return (
    <>
      <PerspectiveCamera makeDefault position={[2, 1.8, 2]} fov={50} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={5}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 4, 3]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-2, 2, -2]} intensity={0.4} color="#00d4ff" />
      <pointLight position={[2, 1.5, 2]} intensity={0.3} color="#ff6b6b" />
      
      <fog attach="fog" args={['#0a0a1a', 2.5, 6]} />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      <Grid
        args={[6, 6]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2a2a4a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3a3a5a"
        fadeDistance={5}
        fadeStrength={1}
        followCamera={false}
      />
      
      {obstacles.map((obs, idx) => (
        <mesh key={idx} position={obs.position} castShadow receiveShadow>
          <boxGeometry args={obs.size} />
          <meshStandardMaterial
            color="#ff4444"
            transparent
            opacity={0.6}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}
      
      {pathPoints.length > 0 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={pathPoints.length}
              array={new Float32Array(pathPoints.flat())}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00d4ff" linewidth={2} />
        </line>
      )}
      
      <group position={targetPosition}>
        <mesh>
          <sphereGeometry args={[0.03, 32, 32]} />
          <meshStandardMaterial
            color={isDraggingTarget ? '#ffff00' : '#00ff00'}
            emissive={isDraggingTarget ? '#ffff00' : '#00ff00'}
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
      
      {multiArmManager.arms.map((arm, idx) => (
        <group key={idx}>
          <RobotArm
            jointAngles={arm.jointAngles}
            isMoving={false}
            baseColor={arm.color}
            position={arm.baseOffset}
            armId={idx}
          />
          {collisions.some(c => (c.arm1 === idx || c.arm2 === idx)) && (
            <mesh position={[
              arm.baseOffset[0],
              arm.baseOffset[1] + 0.5,
              arm.baseOffset[2]
            ]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function App() {
  const kinematicsRef = useRef(new Kinematics());
  const teachRecorderRef = useRef(new TeachRecorder());
  const multiArmManagerRef = useRef(new MultiArmManager(2));
  
  const [multiArmManager, setMultiArmManager] = useState(multiArmManagerRef.current);
  const [activeArmId, setActiveArmId] = useState(0);
  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [targetPosition, setTargetPosition] = useState([0.3, 0.4, 0.3]);
  const [obstacles, setObstacles] = useState([
    { position: [0.2, 0.2, 0.1], size: [0.15, 0.2, 0.15] },
    { position: [-0.15, 0.25, 0.2], size: [0.12, 0.2, 0.12] }
  ]);
  const [pathPoints, setPathPoints] = useState([]);
  const [plannedPath, setPlannedPath] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState(0);
  const [collisions, setCollisions] = useState([]);
  const [showMultiArm, setShowMultiArm] = useState(false);
  
  useEffect(() => {
    const fk = kinematicsRef.current.forwardKinematics(jointAngles);
    multiArmManagerRef.current.setArmJointAngles(activeArmId, jointAngles);
    
    if (showMultiArm) {
      const jointPositionsArray = multiArmManagerRef.current.arms.map(arm => {
        const armFk = kinematicsRef.current.forwardKinematics(arm.jointAngles);
        return armFk.jointPositions;
      });
      const foundCollisions = multiArmManagerRef.current.checkAllCollisions(
        jointPositionsArray, 
        kinematicsRef.current
      );
      setCollisions(foundCollisions);
    } else {
      setCollisions([]);
    }
    
    setMultiArmManager({ ...multiArmManagerRef.current });
  }, [jointAngles, activeArmId, showMultiArm]);
  
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        teachRecorderRef.current.recordPoint(jointAngles);
        setRecordedPoints(teachRecorderRef.current.getTrajectory().length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRecording, jointAngles]);
  
  const handleJointChange = useCallback((index, value) => {
    setJointAngles(prev => {
      const newAngles = [...prev];
      newAngles[index] = parseFloat(value);
      return newAngles;
    });
    setPathPoints([]);
    setPlannedPath([]);
  }, []);
  
  const handleTargetDrag = useCallback((newPos) => {
    setTargetPosition(newPos);
  }, []);
  
  const planPath = useCallback(async () => {
    setIsPlanning(true);
    setPathPoints([]);
    setPlannedPath([]);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const rrtStar = new RRTStar(obstacles);
    const result = rrtStar.plan(jointAngles, targetPosition);
    
    if (result.success) {
      const workspacePath = rrtStar.getWorkspacePath(result.path);
      setPlannedPath(result.path);
      setPathPoints(workspacePath);
    }
    
    setIsPlanning(false);
  }, [jointAngles, targetPosition, obstacles]);
  
  const executePath = useCallback(() => {
    if (plannedPath.length < 2) return;
    
    setIsMoving(true);
    let pathIdx = 0;
    
    const animateStep = () => {
      if (pathIdx >= plannedPath.length - 1) {
        setIsMoving(false);
        return;
      }
      
      const startAngles = plannedPath[pathIdx];
      const endAngles = plannedPath[pathIdx + 1];
      const steps = 20;
      let step = 0;
      
      const interpolateStep = () => {
        step++;
        const t = step / steps;
        const interpolatedAngles = startAngles.map((start, i) =>
          start + (endAngles[i] - start) * t
        );
        
        setJointAngles(interpolatedAngles);
        
        if (step < steps) {
          requestAnimationFrame(interpolateStep);
        } else {
          pathIdx++;
          animateStep();
        }
      };
      
      interpolateStep();
    };
    
    animateStep();
  }, [plannedPath]);
  
  const startRecording = useCallback(() => {
    teachRecorderRef.current.startRecording(jointAngles);
    setIsRecording(true);
    setRecordedPoints(1);
  }, [jointAngles]);
  
  const stopRecording = useCallback(() => {
    teachRecorderRef.current.stopRecording();
    setIsRecording(false);
  }, []);
  
  const playTrajectory = useCallback(() => {
    const result = teachRecorderRef.current.startPlayback(
      (angles) => setJointAngles(angles),
      () => setIsPlaying(false)
    );
    if (result) setIsPlaying(true);
  }, []);
  
  const stopPlayback = useCallback(() => {
    teachRecorderRef.current.stopPlayback();
    setIsPlaying(false);
  }, []);
  
  const exportTrajectory = useCallback(() => {
    const json = teachRecorderRef.current.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trajectory_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  
  const exportPlannedPath = useCallback(() => {
    if (plannedPath.length === 0) return;
    
    const pathData = plannedPath.map((angles, idx) => {
      const fk = kinematicsRef.current.forwardKinematics(angles);
      return {
        jointAngles: angles,
        position: fk.position
      };
    });
    
    const json = exportPathToJSON(pathData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planned_path_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [plannedPath]);
  
  const resetPosition = useCallback(() => {
    setJointAngles([0, 0, 0, 0, 0, 0]);
    setPathPoints([]);
    setPlannedPath([]);
    setIsMoving(false);
    stopPlayback();
  }, [stopPlayback]);
  
  const addObstacle = useCallback(() => {
    const newObstacle = {
      position: [
        (Math.random() - 0.5) * 0.8,
        0.15 + Math.random() * 0.25,
        (Math.random() - 0.5) * 0.8
      ],
      size: [
        0.08 + Math.random() * 0.08,
        0.12 + Math.random() * 0.12,
        0.08 + Math.random() * 0.08
      ]
    };
    setObstacles(prev => [...prev, newObstacle]);
  }, []);
  
  const removeObstacle = useCallback((index) => {
    setObstacles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const switchActiveArm = useCallback((armId) => {
    setActiveArmId(armId);
    const armAngles = multiArmManagerRef.current.getArmJointAngles(armId);
    if (armAngles) {
      setJointAngles(armAngles);
    }
  }, []);
  
  const jointNames = ['关节1 (旋转)', '关节2 (俯仰)', '关节3 (俯仰)', '关节4 (俯仰)', '关节5 (俯仰)', '关节6 (旋转)'];
  const armColors = ['蓝色 (主动臂)', '橙色 (协作臂)'];
  
  return (
    <div className="app">
      <div className="sidebar">
        <h1>🤖 机械臂控制平台</h1>
        
        <div className="panel">
          <div className="status-indicator">
            <span className="status-dot" style={{
              backgroundColor: collisions.length > 0 ? '#ff0000' : '#4caf50'
            }} />
            <span>
              {showMultiArm 
                ? `多臂模式 ${collisions.length > 0 ? '- ⚠️ 碰撞警告' : '- 安全'}` 
                : '单臂模式'
              }
            </span>
          </div>
          
          <button
            className="btn"
            onClick={() => setShowMultiArm(!showMultiArm)}
            style={{ marginTop: '10px', width: '100%', background: showMultiArm ? '#e94560' : '#0f3460' }}
          >
            {showMultiArm ? '🔀 关闭多臂模式' : '🔀 开启多臂模式'}
          </button>
          
          {showMultiArm && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
              {multiArmManager.arms.map((arm, idx) => (
                <button
                  key={idx}
                  className="btn"
                  onClick={() => switchActiveArm(idx)}
                  style={{
                    flex: 1,
                    background: activeArmId === idx ? arm.color : '#333',
                    fontSize: '11px',
                    padding: '8px'
                  }}
                >
                  控制 {armColors[idx]}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="panel">
          <h2>📐 关节控制 ({armColors[activeArmId] || '机械臂'})</h2>
          {jointNames.map((name, index) => (
            <div key={index} className="joint-control">
              <label>
                <span>{name}</span>
                <span>{(jointAngles[index] * 180 / Math.PI).toFixed(1)}°</span>
              </label>
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step={0.01}
                value={jointAngles[index]}
                onChange={(e) => handleJointChange(index, e.target.value)}
                disabled={isMoving || isPlaying}
              />
            </div>
          ))}
        </div>
        
        <div className="panel">
          <h2>🎯 路径规划</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={planPath}
              disabled={isPlanning || isMoving || isPlaying}
              style={{ flex: 1 }}
            >
              {isPlanning ? '规划中...' : '🔍 RRT*规划'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={executePath}
              disabled={isMoving || isPlaying || plannedPath.length < 2}
              style={{ flex: 1 }}
            >
              {isMoving ? '移动中...' : '▶️ 执行'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn"
              onClick={resetPosition}
              style={{ flex: 1, background: '#333' }}
            >
              🔄 重置
            </button>
            <button
              className="btn"
              onClick={exportPlannedPath}
              disabled={plannedPath.length < 2}
              style={{ flex: 1, background: '#2196F3' }}
            >
              💾 导出路径
            </button>
          </div>
          <div className="path-stats" style={{ marginTop: '10px' }}>
            <p>路径点: <span>{pathPoints.length}</span></p>
          </div>
        </div>
        
        <div className="panel">
          <h2>🎬 拖动示教</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isMoving || isPlaying}
              style={{
                flex: 1,
                background: isRecording ? '#ff4444' : '#00C851'
              }}
            >
              {isRecording ? '⏹ 停止录制' : '⏺ 开始录制'}
            </button>
            <button
              className="btn"
              onClick={isPlaying ? stopPlayback : playTrajectory}
              disabled={isRecording || recordedPoints < 2}
              style={{
                flex: 1,
                background: isPlaying ? '#ff4444' : '#33b5e5'
              }}
            >
              {isPlaying ? '⏹ 停止回放' : '▶️ 回放'}
            </button>
          </div>
          <button
            className="btn"
            onClick={exportTrajectory}
            disabled={recordedPoints < 2}
            style={{ width: '100%', marginTop: '8px', background: '#ffbb33' }}
          >
            💾 导出示教轨迹
          </button>
          <div className="path-stats" style={{ marginTop: '10px' }}>
            <p>已录制点: <span>{recordedPoints}</span></p>
            <p>时长: <span>{(teachRecorderRef.current.getDuration() / 1000).toFixed(1)}s</span></p>
          </div>
        </div>
        
        <div className="panel">
          <h2>🚧 障碍物 ({obstacles.length})</h2>
          <div className="obstacle-list">
            {obstacles.map((obs, idx) => (
              <div key={idx} className="obstacle-item">
                <span>障碍 {idx + 1}</span>
                <button onClick={() => removeObstacle(idx)}>×</button>
              </div>
            ))}
          </div>
          <button
            className="btn"
            style={{ marginTop: '10px', width: '100%', background: '#e94560' }}
            onClick={addObstacle}
          >
            + 添加障碍物
          </button>
        </div>
        
        <div className="panel">
          <h2>📍 末端位置</h2>
          <p>X: {kinematicsRef.current.forwardKinematics(jointAngles).position[0].toFixed(3)} m</p>
          <p>Y: {kinematicsRef.current.forwardKinematics(jointAngles).position[1].toFixed(3)} m</p>
          <p>Z: {kinematicsRef.current.forwardKinematics(jointAngles).position[2].toFixed(3)} m</p>
        </div>
      </div>
      
      <div
        className="viewport"
        onMouseDown={(e) => {
          if (e.button === 0 && !isMoving && !isPlaying) setIsDraggingTarget(true);
        }}
        onMouseUp={() => setIsDraggingTarget(false)}
        onMouseLeave={() => setIsDraggingTarget(false)}
      >
        <Canvas
          shadows
          gl={{ antialias: true, alpha: true }}
          style={{ background: '#0a0a1a' }}
        >
          <SceneContent
            multiArmManager={multiArmManager}
            targetPosition={targetPosition}
            obstacles={obstacles}
            pathPoints={pathPoints}
            isPlanning={isPlanning}
            onTargetDrag={handleTargetDrag}
            isDraggingTarget={isDraggingTarget}
            collisions={collisions}
          />
        </Canvas>
        
        <div className="target-info" style={{ maxWidth: '280px' }}>
          <h3>📖 使用说明</h3>
          <p>• 滑块控制各关节角度进行示教</p>
          <p>• 点击"开始录制"记录轨迹，点击回放重现</p>
          <p>• 开启多臂模式可控制两台机械臂协同</p>
          <p>• RRT*算法自动规划避障路径</p>
          <p>• 导出路径和示教轨迹为JSON文件</p>
        </div>
        
        {collisions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(255, 0, 0, 0.9)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: 'bold',
            zIndex: 100
          }}>
            ⚠️ 碰撞警告！机械臂 {collisions.map(c => `${c.arm1 + 1} & ${c.arm2 + 1}`).join(', ')} 发生碰撞
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
