import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export default function HistoryCompare() {
  const { history } = useStore();

  // Generate version models based on version ID
  const getVersionStyle = (versionId: string) => {
    switch (versionId) {
      case 'v1':
        return { color: '#3b82f6', wireframe: false, position: -10 };
      case 'v2':
        return { color: '#f59e0b', wireframe: false, position: 0 };
      case 'v3':
        return { color: '#10b981', wireframe: false, position: 10 };
      default:
        return { color: '#6b7280', wireframe: false, position: 0 };
    }
  };

  if (!history.enabled) return null;

  const leftStyle = history.leftVersion ? getVersionStyle(history.leftVersion) : null;
  const rightStyle = history.rightVersion ? getVersionStyle(history.rightVersion) : null;

  return (
    <group>
      {/* Left version model */}
      {leftStyle && (
        <group position={[leftStyle.position, 0, 0]}>
          {/* Main beam */}
          <mesh position={[0, 2, 0]} castShadow>
            <boxGeometry args={[12, 0.5, 1.5]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>

          {/* Columns */}
          <mesh position={[-5, 0, 0]} castShadow>
            <boxGeometry args={[0.8, 4, 1]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>
          <mesh position={[5, 0, 0]} castShadow>
            <boxGeometry args={[0.8, 4, 1]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.6, 4, 0.8]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>

          {/* Secondary beams */}
          <mesh position={[-2.5, 3.5, 0]} castShadow>
            <boxGeometry args={[5, 0.4, 1]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity * 0.8}
            />
          </mesh>
          <mesh position={[2.5, 3.5, 0]} castShadow>
            <boxGeometry args={[5, 0.4, 1]} />
            <meshStandardMaterial
              color={leftStyle.color}
              transparent
              opacity={history.opacity * 0.8}
            />
          </mesh>

          {/* Version label */}
          <Html position={[0, 6, 0]} center>
            <div
              className="px-4 py-2 rounded-lg text-white font-bold shadow-lg"
              style={{ backgroundColor: leftStyle.color }}
            >
              {history.versions.find((v) => v.id === history.leftVersion)?.name}
            </div>
          </Html>
        </group>
      )}

      {/* Right version model */}
      {rightStyle && (
        <group position={[rightStyle.position, 0, 0]}>
          {/* Main beam - thicker for v3 */}
          <mesh position={[0, 2, 0]} castShadow>
            <boxGeometry args={[12, 0.7, 1.8]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>

          {/* Columns - stronger for v3 */}
          <mesh position={[-5, -0.2, 0]} castShadow>
            <boxGeometry args={[1, 4.4, 1.2]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>
          <mesh position={[5, -0.2, 0]} castShadow>
            <boxGeometry args={[1, 4.4, 1.2]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.8, 4.4, 1]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity}
            />
          </mesh>

          {/* Secondary beams - reinforced for v3 */}
          <mesh position={[-2.5, 3.8, 0]} castShadow>
            <boxGeometry args={[5.5, 0.5, 1.2]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity * 0.8}
            />
          </mesh>
          <mesh position={[2.5, 3.8, 0]} castShadow>
            <boxGeometry args={[5.5, 0.5, 1.2]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity * 0.8}
            />
          </mesh>

          {/* Additional bracing for v3 */}
          <mesh position={[0, 2, 0]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[7, 0.2, 0.3]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity * 0.6}
            />
          </mesh>
          <mesh position={[0, 2, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[7, 0.2, 0.3]} />
            <meshStandardMaterial
              color={rightStyle.color}
              transparent
              opacity={history.opacity * 0.6}
            />
          </mesh>

          {/* Version label */}
          <Html position={[0, 6, 0]} center>
            <div
              className="px-4 py-2 rounded-lg text-white font-bold shadow-lg"
              style={{ backgroundColor: rightStyle.color }}
            >
              {history.versions.find((v) => v.id === history.rightVersion)?.name}
            </div>
          </Html>
        </group>
      )}

      {/* Comparison arrow */}
      <group position={[0, 3, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 18, 8]} />
          <meshBasicMaterial color="#6b7280" transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#6b7280" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* Center comparison info */}
      <Html position={[0, 7, 0]} center>
        <div className="bg-gray-900/95 backdrop-blur-sm px-6 py-3 rounded-xl shadow-xl border border-gray-700">
          <div className="text-center">
            <span className="text-gray-400 text-sm">版本对比</span>
            <div className="flex items-center gap-3 mt-1">
              <span
                className="text-white font-bold"
                style={{ color: leftStyle?.color }}
              >
                {history.versions.find((v) => v.id === history.leftVersion)?.name}
              </span>
              <span className="text-gray-500">→</span>
              <span
                className="text-white font-bold"
                style={{ color: rightStyle?.color }}
              >
                {history.versions.find((v) => v.id === history.rightVersion)?.name}
              </span>
            </div>
          </div>
        </div>
      </Html>

      {/* Difference highlights */}
      {leftStyle && rightStyle && (
        <group>
          <mesh position={[(leftStyle.position + rightStyle.position) / 2, 2, 3]}>
            <boxGeometry args={[0.1, 1, 0.1]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </mesh>
          <Html position={[(leftStyle.position + rightStyle.position) / 2, 3.5, 3]} center>
            <div className="bg-red-500/90 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
              +40% 主梁刚度
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
