import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export default function InspectionPath() {
  const { inspection, setInspectionCurrentIndex } = useStore();
  const { camera } = useThree();
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Path line points
  const pathPoints = useMemo(() => {
    return inspection.path.map((p) => p.position);
  }, [inspection.path]);

  // Camera animation along path
  useFrame((state, delta) => {
    if (!inspection.enabled || !inspection.isPlaying || inspection.path.length < 2) return;

    const currentIdx = inspection.currentIndex;
    const nextIdx = (currentIdx + 1) % inspection.path.length;
    
    const currentPoint = inspection.path[currentIdx].position;
    const nextPoint = inspection.path[nextIdx].position;

    animationRef.current += delta * inspection.speed;

    if (animationRef.current >= 1) {
      animationRef.current = 0;
      setInspectionCurrentIndex(nextIdx);
      return;
    }

    // Smooth camera movement
    const t = animationRef.current;
    const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const newPos = new THREE.Vector3(
      currentPoint[0] + (nextPoint[0] - currentPoint[0]) * easeT,
      currentPoint[1] + (nextPoint[1] - currentPoint[1]) * easeT + 2,
      currentPoint[2] + (nextPoint[2] - currentPoint[2]) * easeT + 3
    );

    camera.position.lerp(newPos, 0.05);
    
    // Look at the structure
    const target = new THREE.Vector3(0, 2, 0);
    camera.lookAt(target);
  });

  useEffect(() => {
    if (!inspection.enabled) {
      animationRef.current = 0;
    }
  }, [inspection.enabled]);

  if (!inspection.enabled) return null;

  return (
    <group>
      {/* Path line */}
      <Line
        points={pathPoints}
        color="#10b981"
        lineWidth={3}
        dashed={false}
      />

      {/* Inspection points */}
      {inspection.path.map((point, index) => {
        const isCurrent = index === inspection.currentIndex;
        const isChecked = point.checked;

        return (
          <group key={point.id} position={point.position}>
            {/* Point marker */}
            <mesh>
              <sphereGeometry args={[isCurrent ? 0.35 : 0.25, 16, 16]} />
              <meshBasicMaterial
                color={isCurrent ? '#10b981' : isChecked ? '#34d399' : '#6ee7b7'}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* Pulse ring for current point */}
            {isCurrent && (
              <mesh>
                <ringGeometry args={[0.4, 0.5, 32]} />
                <meshBasicMaterial
                  color="#10b981"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}

            {/* Point label */}
            <Html position={[0, 0.8, 0]} center>
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg"
                style={{
                  backgroundColor: isCurrent ? '#10b981' : isChecked ? '#34d399' : '#6ee7b7',
                  color: isCurrent ? 'white' : '#065f46',
                }}
              >
                <span className="mr-1">{index + 1}.</span>
                {point.name}
                {isChecked && <span className="ml-1">✓</span>}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Direction arrows between points */}
      {inspection.path.slice(0, -1).map((point, index) => {
        const nextPoint = inspection.path[index + 1];
        const midPos = [
          (point.position[0] + nextPoint.position[0]) / 2,
          (point.position[1] + nextPoint.position[1]) / 2,
          (point.position[2] + nextPoint.position[2]) / 2,
        ];

        return (
          <mesh key={`arrow-${index}`} position={midPos}>
            <coneGeometry args={[0.1, 0.3, 8]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        );
      })}
    </group>
  );
}
