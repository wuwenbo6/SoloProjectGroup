import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface BlochSphereProps {
  coordinates?: { x: number; y: number; z: number };
  qubitIndex?: number;
}

export const BlochSphere: React.FC<BlochSphereProps> = ({ coordinates, qubitIndex = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const stateVectorRef = useRef<THREE.ArrowHelper | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x16213e,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    const wireframeGeometry = new THREE.SphereGeometry(1, 16, 16);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f3460,
      wireframe: true,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    const axisMaterial = new THREE.LineBasicMaterial({ color: 0x533483, linewidth: 2 });
    const axisLength = 1.2;

    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0, 0),
      new THREE.Vector3(axisLength, 0, 0),
    ]);
    const xAxis = new THREE.Line(xAxisGeometry, axisMaterial);
    scene.add(xAxis);

    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const yAxis = new THREE.Line(yAxisGeometry, axisMaterial);
    scene.add(yAxis);

    const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -axisLength),
      new THREE.Vector3(0, 0, axisLength),
    ]);
    const zAxis = new THREE.Line(zAxisGeometry, axisMaterial);
    scene.add(zAxis);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xe94560, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const stateVectorDirection = new THREE.Vector3(0, 0, 1);
    const stateVector = new THREE.ArrowHelper(
      stateVectorDirection.normalize(),
      new THREE.Vector3(0, 0, 0),
      1,
      0xe94560,
      0.1,
      0.05
    );
    scene.add(stateVector);
    stateVectorRef.current = stateVector;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (stateVectorRef.current && coordinates) {
      const { x, y, z } = coordinates;
      const direction = new THREE.Vector3(x, y, z);
      const length = direction.length();
      if (length > 0) {
        direction.normalize();
        stateVectorRef.current.setDirection(direction);
        stateVectorRef.current.setLength(length, 0.1, 0.05);
      }
    }
  }, [coordinates]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '300px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          color: '#e94560',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        Qubit {qubitIndex}
      </div>
    </div>
  );
};
