import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PointerLockControls } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export default function VRMode() {
  const { vr } = useStore();
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const canJump = useRef(false);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  // Handle keyboard input for WASD movement
  useEffect(() => {
    if (!vr.enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          moveForward.current = true;
          break;
        case 'KeyA':
          moveLeft.current = true;
          break;
        case 'KeyS':
          moveBackward.current = true;
          break;
        case 'KeyD':
          moveRight.current = true;
          break;
        case 'Space':
          if (canJump.current) {
            velocityRef.current.y += 10;
            canJump.current = false;
          }
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          moveForward.current = false;
          break;
        case 'KeyA':
          moveLeft.current = false;
          break;
        case 'KeyS':
          moveBackward.current = false;
          break;
        case 'KeyD':
          moveRight.current = false;
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [vr.enabled]);

  // First-person movement physics
  useFrame((state, delta) => {
    if (!vr.enabled || !controlsRef.current?.isLocked) return;

    const speed = 15;
    const damping = 10;
    const gravity = 30;

    // Apply gravity
    velocityRef.current.y -= gravity * delta;

    // Handle movement
    if (moveForward.current) directionRef.current.z -= 1;
    if (moveBackward.current) directionRef.current.z += 1;
    if (moveLeft.current) directionRef.current.x -= 1;
    if (moveRight.current) directionRef.current.x += 1;

    directionRef.current.normalize();

    if (moveForward.current || moveBackward.current || moveLeft.current || moveRight.current) {
      velocityRef.current.x -= directionRef.current.x * speed * delta * damping;
      velocityRef.current.z -= directionRef.current.z * speed * delta * damping;
    }

    // Reset direction
    directionRef.current.set(0, 0, 0);

    // Apply velocity to camera
    controlsRef.current.moveRight(-velocityRef.current.x * delta);
    controlsRef.current.moveForward(-velocityRef.current.z * delta);
    camera.position.y += velocityRef.current.y * delta;

    // Ground collision
    if (camera.position.y < 2) {
      velocityRef.current.y = 0;
      camera.position.y = 2;
      canJump.current = true;
    }

    // Damping
    velocityRef.current.x *= Math.pow(0.1, delta);
    velocityRef.current.z *= Math.pow(0.1, delta);
  });

  if (!vr.enabled) return null;

  return (
    <group>
      {/* PointerLockControls for first-person */}
      <PointerLockControls ref={controlsRef} />

      {/* VR HUD */}
      <Html position={[0, 2.5, -5]} center zIndexRange={[100, 0]}>
        <div className="bg-black/70 backdrop-blur-sm px-6 py-4 rounded-xl text-center pointer-events-none">
          <h3 className="text-white font-bold text-lg mb-2">🔮 VR 模式已启用</h3>
          <p className="text-gray-300 text-sm">
            点击屏幕锁定鼠标以获得沉浸式体验
          </p>
          <div className="mt-3 flex justify-center gap-4 text-xs text-gray-400">
            <span>W - 前进</span>
            <span>S - 后退</span>
            <span>A - 左移</span>
            <span>D - 右移</span>
            <span>空格 - 跳跃</span>
          </div>
        </div>
      </Html>

      {/* VR Grid floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.8} />
      </mesh>

      {/* Grid lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#374151" wireframe transparent opacity={0.5} />
      </mesh>

      {/* Teleport markers */}
      {[
        [-8, 0, 0],
        [8, 0, 0],
        [0, 0, -8],
        [0, 0, 8],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.1, 0.15, 32]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}

      {/* Scale reference cubes */}
      {[[-10, 1, -10], [10, 1, -10], [-10, 1, 10], [10, 1, 10]].map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#4b5563" transparent opacity={0.5} wireframe />
        </mesh>
      ))}

      {/* VR boundary */}
      <group position={[0, 5, 0]}>
        {[0, 90, 180, 270].map((rot, i) => (
          <mesh key={i} rotation={[0, (rot * Math.PI) / 180, 0]} position={[0, 0, -15]}>
            <boxGeometry args={[30, 10, 0.1]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
          </mesh>
        ))}
      </group>

      {/* FOV indicator */}
      <Html position={[10, 8, 0]} center>
        <div className="bg-black/60 px-3 py-2 rounded-lg text-center pointer-events-none">
          <span className="text-gray-400 text-xs">FOV</span>
          <p className="text-white font-bold">{vr.fov}°</p>
        </div>
      </Html>

      {/* Compass */}
      <Html position={[-10, 8, 0]} center>
        <div className="bg-black/60 px-4 py-3 rounded-full text-center pointer-events-none">
          <span className="text-2xl">🧭</span>
        </div>
      </Html>
    </group>
  );
}
