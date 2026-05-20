import React, { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, useGLTF, BoxHelper } from '@react-three/drei';
import * as THREE from 'three';
import { useCRDTStore } from '../store/crdtStore';

function Model({ url, material, skeletonData, onSkeletonLoaded }) {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef();
  const mixerRef = useRef(null);
  const skeletonHelperRef = useRef(null);

  useEffect(() => {
    if (material && scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (material.color) {
            child.material.color = new THREE.Color(material.color);
          }
          if (material.metalness !== undefined) {
            child.material.metalness = material.metalness;
          }
          if (material.roughness !== undefined) {
            child.material.roughness = material.roughness;
          }
          if (material.map) {
            const loader = new THREE.TextureLoader();
            loader.load(material.map, (texture) => {
              child.material.map = texture;
              child.material.needsUpdate = true;
            });
          }
        }
      });
    }
  }, [scene, material]);

  useEffect(() => {
    if (scene && animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(scene);
      animations.forEach((clip) => {
        const action = mixerRef.current.clipAction(clip);
        action.play();
      });

      const skeleton = scene.children.find((child) => child.skeleton);
      if (skeleton) {
        skeletonHelperRef.current = new THREE.SkeletonHelper(skeleton);
        if (groupRef.current && skeletonHelperRef.current) {
          groupRef.current.add(skeletonHelperRef.current);
        }
      }
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [scene, animations]);

  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    return cloned;
  }, [scene]);

  return <primitive ref={groupRef} object={clonedScene} />;
}

function PrimitiveMesh({ type, material }) {
  const meshRef = useRef();
  const [geometry, setGeometry] = useState(null);

  useEffect(() => {
    switch (type) {
      case 'box':
        setGeometry(new THREE.BoxGeometry(1, 1, 1));
        break;
      case 'sphere':
        setGeometry(new THREE.SphereGeometry(0.5, 32, 32));
        break;
      case 'cylinder':
        setGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 32));
        break;
      case 'cone':
        setGeometry(new THREE.ConeGeometry(0.5, 1, 32));
        break;
      case 'torus':
        setGeometry(new THREE.TorusGeometry(0.5, 0.2, 16, 100));
        break;
      case 'plane':
        setGeometry(new THREE.PlaneGeometry(1, 1));
        break;
      default:
        setGeometry(new THREE.BoxGeometry(1, 1, 1));
    }
  }, [type]);

  const threeMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: material?.color || '#4a90d9',
      metalness: material?.metalness || 0.1,
      roughness: material?.roughness || 0.5,
      skinning: true,
    });

    if (material?.map) {
      const loader = new THREE.TextureLoader();
      loader.load(material.map, (texture) => {
        mat.map = texture;
        mat.needsUpdate = true;
      });
    }

    return mat;
  }, [material]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={threeMaterial} castShadow receiveShadow />
  );
}

const SceneNode = ({ nodeData, isSelected, onSelect, transformMode }) => {
  const groupRef = useRef();
  const transformRef = useRef();
  const { camera, gl } = useThree();

  const {
    setNodePosition,
    setNodeRotation,
    setNodeScale,
    getSkeletonData,
    interpolateKeyframes,
    animations,
    scenes,
    currentSceneId,
  } = useCRDTStore();

  const [localPosition, setLocalPosition] = useState([0, 0, 0]);
  const [localRotation, setLocalRotation] = useState([0, 0, 0]);
  const [localScale, setLocalScale] = useState([1, 1, 1]);
  const [isDragging, setIsDragging] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);

  useEffect(() => {
    if (nodeData.position) {
      setLocalPosition([
        nodeData.position.x || 0,
        nodeData.position.y || 0,
        nodeData.position.z || 0,
      ]);
    }
    if (nodeData.rotation) {
      setLocalRotation([
        nodeData.rotation.x || 0,
        nodeData.rotation.y || 0,
        nodeData.rotation.z || 0,
      ]);
    }
    if (nodeData.scale) {
      setLocalScale([
        nodeData.scale.x || 1,
        nodeData.scale.y || 1,
        nodeData.scale.z || 1,
      ]);
    }
  }, [nodeData]);

  const currentScene = scenes[currentSceneId];
  const activeAnimationId = currentScene?.activeAnimationId;
  const activeAnimation = animations[activeAnimationId];

  useFrame(() => {
    if (activeAnimation && activeAnimation.nodeId === nodeData.id) {
      const tracks = activeAnimation.tracks || {};

      const posValue = interpolateKeyframes(tracks.position, activeAnimation.currentTime);
      if (posValue && groupRef.current) {
        groupRef.current.position.set(posValue.x, posValue.y, posValue.z);
      }

      const rotValue = interpolateKeyframes(tracks.rotation, activeAnimation.currentTime);
      if (rotValue && groupRef.current) {
        groupRef.current.rotation.set(rotValue.x, rotValue.y, rotValue.z);
      }

      const scaleValue = interpolateKeyframes(tracks.scale, activeAnimation.currentTime);
      if (scaleValue && groupRef.current) {
        groupRef.current.scale.set(scaleValue.x, scaleValue.y, scaleValue.z);
      }
    } else if (!isDragging && groupRef.current) {
      groupRef.current.position.lerp(new THREE.Vector3(...localPosition), 0.1);
      groupRef.current.rotation.set(...localRotation);
      groupRef.current.scale.lerp(new THREE.Vector3(...localScale), 0.1);
    }
  });

  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current;

      const onMouseDown = () => {
        setIsDragging(true);
        setShowBoundingBox(true);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        if (groupRef.current) {
          const obj = groupRef.current;
          setNodePosition(nodeData.id, {
            x: obj.position.x,
            y: obj.position.y,
            z: obj.position.z,
          });

          setNodeRotation(nodeData.id, {
            x: obj.rotation.x,
            y: obj.rotation.y,
            z: obj.rotation.z,
          });

          setNodeScale(nodeData.id, {
            x: obj.scale.x,
            y: obj.scale.y,
            z: obj.scale.z,
          });
        }
      };

      controls.addEventListener('mouseDown', onMouseDown);
      controls.addEventListener('mouseUp', onMouseUp);

      return () => {
        controls.removeEventListener('mouseDown', onMouseDown);
        controls.removeEventListener('mouseUp', onMouseUp);
      };
    }
  }, [nodeData.id, setNodePosition, setNodeRotation, setNodeScale]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <>
      <group
        ref={groupRef}
        position={localPosition}
        rotation={localRotation}
        scale={localScale}
        onPointerDown={handlePointerDown}
      >
        <Suspense fallback={null}>
          {nodeData.type === 'gltf' && nodeData.url ? (
            <Model url={nodeData.url} material={nodeData.material} skeletonData={getSkeletonData(nodeData.id)} />
          ) : (
            <>
              <PrimitiveMesh type={nodeData.type} material={nodeData.material} />
              {isSelected && showBoundingBox && <BoxHelper object={groupRef.current} color="#3b82f6" />}
            </>
          )}
        </Suspense>
      </group>

      {isSelected && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode={transformMode}
          camera={camera}
          size={0.8}
        />
      )}
    </>
  );
};

export default SceneNode;
