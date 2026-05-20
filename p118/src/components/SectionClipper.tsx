import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

export default function SectionClipper() {
  const { section } = useStore();
  const { scene } = useThree();

  const clippingPlane = useMemo(() => {
    const plane = new THREE.Plane();
    return plane;
  }, []);

  useMemo(() => {
    if (!section.enabled) return;

    let normal = new THREE.Vector3();
    let constant = 0;

    switch (section.axis) {
      case 'x':
        normal.set(1, 0, 0);
        constant = -section.position * 6;
        break;
      case 'y':
        normal.set(0, 1, 0);
        constant = -(section.position * 4 + 2);
        break;
      case 'z':
        normal.set(0, 0, 1);
        constant = -section.position * 3;
        break;
    }

    clippingPlane.set(normal, constant);

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
            mat.clippingPlanes = section.enabled ? [clippingPlane] : [];
            mat.clipShadows = true;
          }
        });
      }
    });
  }, [section, scene, clippingPlane]);

  if (!section.enabled) return null;

  const getPlanePosition = (): [number, number, number] => {
    switch (section.axis) {
      case 'x':
        return [section.position * 6, 2, 0];
      case 'y':
        return [0, section.position * 4 + 2, 0];
      case 'z':
        return [0, 2, section.position * 3];
      default:
        return [0, 2, 0];
    }
  };

  const getPlaneRotation = (): [number, number, number] => {
    switch (section.axis) {
      case 'x':
        return [0, Math.PI / 2, 0];
      case 'y':
        return [Math.PI / 2, 0, 0];
      case 'z':
        return [0, 0, 0];
      default:
        return [0, 0, 0];
    }
  };

  return (
    <group>
      {/* Section plane visualization */}
      <mesh
        position={getPlanePosition()}
        rotation={getPlaneRotation()}
        renderOrder={1}
      >
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial
          color="#165DFF"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Section plane border */}
      <mesh position={getPlanePosition()} rotation={getPlaneRotation()}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial
          color="#165DFF"
          transparent
          opacity={0.6}
          wireframe
          depthWrite={false}
        />
      </mesh>
      
      {/* Axis indicator sphere */}
      <mesh position={getPlanePosition()}>
        <sphereGeometry args={[0.25]} />
        <meshBasicMaterial color="#165DFF" />
      </mesh>
      
      {/* Axis label */}
      <mesh position={[getPlanePosition()[0] + 0.5, getPlanePosition()[1] + 0.5, getPlanePosition()[2]]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  );
}
