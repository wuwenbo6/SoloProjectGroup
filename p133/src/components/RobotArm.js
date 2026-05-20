import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Link({ length, radius, color, position, rotation }) {
  const meshRef = useRef();
  
  const geometry = useMemo(() => {
    const cylGeom = new THREE.CylinderGeometry(radius, radius, length, 32);
    cylGeom.translate(0, length / 2, 0);
    return cylGeom;
  }, [length, radius]);
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

function Joint({ position, rotation, children, size = 0.04, color }) {
  const groupRef = useRef();
  const jointColor = color || '#ff6b6b';
  
  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh castShadow>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={jointColor} metalness={0.5} roughness={0.3} />
      </mesh>
      {children}
    </group>
  );
}

function EndEffector({ position, rotation, color }) {
  const eeColor = color || '#4ecdc4';
  
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.02, 0.08, 0.02]} />
        <meshStandardMaterial color={eeColor} />
      </mesh>
      <mesh position={[-0.025, 0.02, 0]} castShadow>
        <boxGeometry args={[0.01, 0.04, 0.01]} />
        <meshStandardMaterial color={eeColor} />
      </mesh>
      <mesh position={[0.025, 0.02, 0]} castShadow>
        <boxGeometry args={[0.01, 0.04, 0.01]} />
        <meshStandardMaterial color={eeColor} />
      </mesh>
    </group>
  );
}

export default function RobotArm({ 
  jointAngles, 
  isMoving, 
  baseColor = '#00d4ff',
  position = [0, 0, 0],
  armId = 0 
}) {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (groupRef.current && isMoving) {
    }
  });
  
  const dhParams = useMemo(() => [
    { d: 0.15, a: 0, alpha: Math.PI / 2 },
    { d: 0, a: 0.2, alpha: 0 },
    { d: 0, a: 0.15, alpha: 0 },
    { d: 0, a: 0, alpha: Math.PI / 2 },
    { d: 0.1, a: 0, alpha: -Math.PI / 2 },
    { d: 0.08, a: 0, alpha: 0 }
  ], []);
  
  const colors = useMemo(() => {
    const baseRgb = typeof baseColor === 'string' 
      ? new THREE.Color(baseColor) 
      : new THREE.Color().fromArray(baseColor);
    
    const shades = [];
    for (let i = 0; i < 6; i++) {
      const factor = 1 - i * 0.12;
      shades.push(new THREE.Color(
        baseRgb.r * factor,
        baseRgb.g * factor,
        baseRgb.b * factor
      ).getStyle());
    }
    return shades;
  }, [baseColor]);
  
  const jointColor = colors[0];
  const eeColor = colors[5];
  
  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.025, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.05, 64]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      
      <Joint position={[0, 0.05, 0]} rotation={[0, jointAngles[0], 0]} size={0.05} color={jointColor}>
        <Link
          length={dhParams[0].d}
          radius={0.03}
          color={colors[0]}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        
        <Joint position={[0, dhParams[0].d, 0]} rotation={[0, 0, jointAngles[1]]} size={0.045} color={jointColor}>
          <Link
            length={dhParams[1].a}
            radius={0.025}
            color={colors[1]}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
          />
          
          <Joint position={[dhParams[1].a, 0, 0]} rotation={[0, 0, jointAngles[2]]} size={0.04} color={jointColor}>
            <Link
              length={dhParams[2].a}
              radius={0.022}
              color={colors[2]}
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
            />
            
            <Joint position={[dhParams[2].a, 0, 0]} rotation={[0, 0, jointAngles[3]]} size={0.035} color={jointColor}>
              <Link
                length={0.05}
                radius={0.018}
                color={colors[3]}
                position={[0, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              />
              
              <Joint position={[0, 0.05, 0]} rotation={[0, 0, jointAngles[4]]} size={0.032} color={jointColor}>
                <Link
                  length={dhParams[4].d}
                  radius={0.015}
                  color={colors[4]}
                  position={[0, 0, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                />
                
                <Joint position={[0, dhParams[4].d, 0]} rotation={[0, 0, jointAngles[5]]} size={0.03} color={jointColor}>
                  <Link
                    length={dhParams[5].d}
                    radius={0.012}
                    color={colors[5]}
                    position={[0, 0, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                  
                  <EndEffector position={[0, dhParams[5].d, 0]} rotation={[Math.PI / 2, 0, 0]} color={eeColor} />
                </Joint>
              </Joint>
            </Joint>
          </Joint>
        </Joint>
      </Joint>
    </group>
  );
}
