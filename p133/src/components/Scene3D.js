import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import RobotArm from './RobotArm';

function Obstacle({ position, size, color = '#ff4444', onRemove, id }) {
  const meshRef = useRef();
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.7}
        metalness={0.3}
        roughness={0.5}
      />
    </mesh>
  );
}

function TargetPoint({ position, onDrag, isDragging }) {
  const meshRef = useRef();
  const { camera, raycaster, mouse } = useThree();
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  
  useFrame(() => {
    if (isDragging && meshRef.current) {
      raycaster.setFromCamera(mouse, camera);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeRef.current, intersectPoint);
      if (intersectPoint) {
        const newPos = [
          Math.max(-0.8, Math.min(0.8, intersectPoint.x)),
          Math.max(0.1, Math.min(1, Math.abs(intersectPoint.y))),
          Math.max(-0.8, Math.min(0.8, intersectPoint.z))
        ];
        onDrag(newPos);
      }
    }
  });
  
  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.025, 32, 32]} />
        <meshStandardMaterial
          color={isDragging ? '#ffff00' : '#00ff00'}
          emissive={isDragging ? '#ffff00' : '#00ff00'}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.05, 64]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PathLine({ points, color = '#00d4ff' }) {
  const lineRef = useRef();
  
  const geometry = useMemo(() => {
    if (points.length < 2) return new THREE.BufferGeometry();
    
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i][0];
      positions[i * 3 + 1] = points[i][1];
      positions[i * 3 + 2] = points[i][2];
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [points]);
  
  if (points.length < 2) return null;
  
  return (
    <line ref={lineRef}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[3, 3]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

function WorkspaceBounds() {
  const points = useMemo(() => {
    const pts = [];
    const size = 0.68;
    const height = 0.68;
    
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      pts.push([Math.cos(angle) * size, height, Math.sin(angle) * size]);
    }
    return pts;
  }, []);
  
  return (
    <>
      <PathLine points={points} color="#333" />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, size, 64]} />
        <meshBasicMaterial color="#222" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

function SceneContent({
  jointAngles,
  targetPosition,
  obstacles,
  pathPoints,
  isMoving,
  onTargetDrag,
  isDraggingTarget,
  isPlanning
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[1.5, 1.2, 1.5]} fov={50} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={3}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 3, 2]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={10}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
      />
      <pointLight position={[-1, 2, -1]} intensity={0.5} color="#00d4ff" />
      <pointLight position={[1, 1, 1]} intensity={0.3} color="#ff6b6b" />
      
      <fog attach="fog" args={['#0a0a1a', 1.5, 4]} />
      
      <Ground />
      <Grid
        args={[3, 3]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#2a2a4a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3a3a5a"
        fadeDistance={3}
        fadeStrength={1}
        followCamera={false}
      />
      
      <WorkspaceBounds />
      
      {obstacles.map((obs, idx) => (
        <Obstacle
          key={idx}
          id={idx}
          position={obs.position}
          size={obs.size}
        />
      ))}
      
      {pathPoints.length > 0 && (
        <>
          <PathLine points={pathPoints} color="#00d4ff" />
          {pathPoints.map((point, idx) => (
            <mesh key={idx} position={point}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color="#00d4ff" />
            </mesh>
          ))}
        </>
      )}
      
      <TargetPoint
        position={targetPosition}
        onDrag={onTargetDrag}
        isDragging={isDraggingTarget}
      />
      
      <RobotArm jointAngles={jointAngles} isMoving={isMoving} />
    </>
  );
}

export default function Scene3D(props) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: '#0a0a1a' }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
