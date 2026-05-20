import { useMemo } from 'react';
import * as THREE from 'three';

// Reusable geometry instances
const useSharedGeometries = () => {
  return useMemo(() => ({
    beam: new THREE.BoxGeometry(12, 0.5, 1.5),
    columnLarge: new THREE.BoxGeometry(0.8, 4, 1),
    columnSmall: new THREE.BoxGeometry(0.6, 4, 0.8),
    secondaryBeam: new THREE.BoxGeometry(5, 0.4, 1),
    floor: new THREE.BoxGeometry(20, 0.2, 15),
    brace: new THREE.BoxGeometry(5, 0.2, 0.3),
  }), []);
};

// Reusable materials
const useSharedMaterials = () => {
  return useMemo(() => ({
    steel: new THREE.MeshStandardMaterial({
      color: '#4E5969',
      metalness: 0.7,
      roughness: 0.3,
    }),
    column: new THREE.MeshStandardMaterial({
      color: '#3A86FF',
      metalness: 0.5,
      roughness: 0.4,
    }),
    secondarySteel: new THREE.MeshStandardMaterial({
      color: '#6B7280',
      metalness: 0.6,
      roughness: 0.3,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: '#374151',
      metalness: 0.3,
      roughness: 0.7,
    }),
    brace: new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.6,
      roughness: 0.3,
    }),
  }), []);
};

export default function DemoModel() {
  const geometries = useSharedGeometries();
  const materials = useSharedMaterials();

  return useMemo(() => (
    <group>
      {/* Main beam */}
      <mesh position={[0, 2, 0]} geometry={geometries.beam} material={materials.steel} castShadow receiveShadow />
      
      {/* Columns */}
      <mesh position={[-5, 0, 0]} geometry={geometries.columnLarge} material={materials.column} castShadow receiveShadow />
      <mesh position={[5, 0, 0]} geometry={geometries.columnLarge} material={materials.column} castShadow receiveShadow />
      <mesh position={[0, 0, 0]} geometry={geometries.columnSmall} material={materials.column} castShadow receiveShadow />
      
      {/* Secondary beams */}
      <mesh position={[-2.5, 3.5, 0]} geometry={geometries.secondaryBeam} material={materials.secondarySteel} castShadow receiveShadow />
      <mesh position={[2.5, 3.5, 0]} geometry={geometries.secondaryBeam} material={materials.secondarySteel} castShadow receiveShadow />
      
      {/* Floor base */}
      <mesh position={[0, -2.1, 0]} geometry={geometries.floor} material={materials.floor} receiveShadow />
      
      {/* Diagonal braces */}
      <mesh position={[-2.5, 2, 0]} rotation={[0, 0, 0.6]} geometry={geometries.brace} material={materials.brace} castShadow />
      <mesh position={[-2.5, 2, 0]} rotation={[0, 0, -0.6]} geometry={geometries.brace} material={materials.brace} castShadow />
      <mesh position={[2.5, 2, 0]} rotation={[0, 0, 0.6]} geometry={geometries.brace} material={materials.brace} castShadow />
      <mesh position={[2.5, 2, 0]} rotation={[0, 0, -0.6]} geometry={geometries.brace} material={materials.brace} castShadow />
    </group>
  ), [geometries, materials]);
}
