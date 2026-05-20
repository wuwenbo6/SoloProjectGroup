import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export default function CorrosionEffect() {
  const { corrosion } = useStore();

  // Pre-create geometries
  const geometries = useMemo(() => ({
    spotLarge: new THREE.SphereGeometry(0.8, 16, 16),
    spotMedium: new THREE.SphereGeometry(0.6, 16, 16),
    spotSmall: new THREE.SphereGeometry(0.2, 8, 8),
    columnSpot: new THREE.BoxGeometry(0.3, 1.5, 0.3),
    cylinderSpot: new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
  }), []);

  // Create materials with proper opacity based on intensity
  const materials = useMemo(() => {
    const baseOpacity = 0.3 + corrosion.intensity * 0.5;
    return {
      darkBrown: new THREE.MeshStandardMaterial({
        color: '#8B4513',
        transparent: true,
        opacity: baseOpacity,
        roughness: 1,
      }),
      mediumBrown: new THREE.MeshStandardMaterial({
        color: '#A0522D',
        transparent: true,
        opacity: baseOpacity,
        roughness: 1,
      }),
      lightBrown: new THREE.MeshStandardMaterial({
        color: '#CD853F',
        transparent: true,
        opacity: 0.4 + corrosion.intensity * 0.4,
        roughness: 0.9,
      }),
      severe: new THREE.MeshBasicMaterial({ color: '#F53F3F' }),
      moderate: new THREE.MeshBasicMaterial({ color: '#FF7D00' }),
      minor: new THREE.MeshBasicMaterial({ color: '#00B42A' }),
    };
  }, [corrosion.intensity]);

  if (!corrosion.enabled) return null;

  const getSeverityMaterial = (threshold: number) => 
    corrosion.intensity > threshold ? materials.severe : (corrosion.intensity > threshold - 0.2 ? materials.moderate : materials.minor);

  return useMemo(() => (
    <group>
      {/* Corrosion spots on main beam */}
      <mesh position={[-3, 2, 0.5]} geometry={geometries.spotLarge} material={materials.darkBrown} />
      <mesh position={[2, 2, -0.5]} geometry={geometries.spotMedium} material={materials.mediumBrown} />
      
      {/* Column corrosion */}
      <mesh position={[4, 0, 0.3]} geometry={geometries.columnSpot} material={materials.lightBrown} />
      <mesh position={[-4, 1, -0.2]} geometry={geometries.cylinderSpot} material={materials.darkBrown} />
      
      {/* Corrosion severity indicators */}
      <mesh position={[-3, 3.5, 0.5]} geometry={geometries.spotSmall} material={corrosion.intensity > 0.6 ? materials.severe : materials.moderate} />
      <mesh position={[2, 3.5, -0.5]} geometry={geometries.spotSmall} material={corrosion.intensity > 0.4 ? materials.moderate : materials.minor} />
      
      {/* Additional corrosion spots for realism */}
      <mesh position={[-1, 2.2, 0.6]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <primitive object={materials.mediumBrown} />
      </mesh>
      <mesh position={[3.5, 2.1, -0.4]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <primitive object={materials.lightBrown} />
      </mesh>
    </group>
  ), [geometries, materials, corrosion.intensity]);
}
