import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export default function StressEffect() {
  const { stress } = useStore();
  const groupRef = useRef<THREE.Group>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // Pre-calculate stress data points (simulated structural analysis)
  const stressPoints = useMemo(() => {
    return [
      { pos: [-5, 2, 0], value: 0.92, color: '#F53F3F', label: '最大应力' },
      { pos: [0, 2, 0], value: 0.68, color: '#FF7D00', label: '中应力' },
      { pos: [5, 2, 0], value: 0.92, color: '#F53F3F', label: '最大应力' },
      { pos: [-2.5, 3.5, 0], value: 0.45, color: '#F59E0B', label: '低应力' },
      { pos: [2.5, 3.5, 0], value: 0.45, color: '#F59E0B', label: '低应力' },
      { pos: [-5, 0, 0], value: 0.58, color: '#FF7D00', label: '柱顶应力' },
      { pos: [5, 0, 0], value: 0.58, color: '#FF7D00', label: '柱顶应力' },
      { pos: [0, 0, 0], value: 0.35, color: '#00B42A', label: '安全区域' },
    ];
  }, []);

  // Create gradient canvas once
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = 256;
    canvasRef.current.height = 32;
    const ctx = canvasRef.current.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#00B42A');
    gradient.addColorStop(0.5, '#FF7D00');
    gradient.addColorStop(1, '#F53F3F');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 32);

    textureRef.current = new THREE.CanvasTexture(canvasRef.current);
    
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

  // Animation loop for stress visualization
  useFrame((state) => {
    if (!groupRef.current || !stress.enabled) return;
    
    const time = state.clock.elapsedTime * stress.animationSpeed;
    groupRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh && child.userData.isStressPoint) {
        const scale = 1 + Math.sin(time * 2 + i * 0.5) * 0.15;
        child.scale.setScalar(scale);
      }
    });
  });

  if (!stress.enabled) return null;

  return (
    <group ref={groupRef}>
      {/* Stress heatmap spheres with data-driven sizing */}
      {stressPoints.map((point, index) => (
        <mesh 
          key={index} 
          position={point.pos}
          userData={{ isStressPoint: true }}
        >
          <sphereGeometry args={[0.25 + point.value * 0.35, 16, 16]} />
          <meshBasicMaterial
            color={point.color}
            transparent
            opacity={0.35 + point.value * 0.35}
          />
        </mesh>
      ))}
      
      {/* Stress flow direction indicators */}
      {[[-4, 2, 0], [-1, 2, 0], [1, 2, 0], [4, 2, 0]].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.12, 0.35, 8]} />
            <meshBasicMaterial color="#F53F3F" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
      
      {/* Deformation visualization wireframe */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[12, 0.1, 1.5]} />
        <meshBasicMaterial color="#165DFF" transparent opacity={0.35} wireframe />
      </mesh>
      
      {/* Legend background */}
      <mesh position={[0, 5.2, 5]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[4.5, 1.2]} />
        <meshBasicMaterial color="#1D2129" transparent opacity={0.95} />
      </mesh>
      
      {/* Color gradient legend */}
      <mesh position={[0, 5.4, 5.01]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial map={textureRef.current} toneMapped={false} />
      </mesh>
      
      {/* Legend text labels */}
      <Html position={[-1.8, 5.1, 5.1]} center>
        <span className="text-xs text-gray-400">低</span>
      </Html>
      <Html position={[0, 5.1, 5.1]} center>
        <span className="text-xs text-gray-400">中</span>
      </Html>
      <Html position={[1.8, 5.1, 5.1]} center>
        <span className="text-xs text-gray-400">高</span>
      </Html>
      <Html position={[0, 5.8, 5.1]} center>
        <span className="text-sm text-white font-medium">应力分布 (MPa)</span>
      </Html>
      
      {/* Maximum stress annotation */}
      <Html position={[-5, 3, 0]} center>
        <div className="bg-red-500/80 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
          Max: {(stressPoints[0].value * 100).toFixed(0)} MPa
        </div>
      </Html>
    </group>
  );
}
