import { useState, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useStore } from '@/store/useStore';

export default function Annotations() {
  const { activeTool, annotations, addAnnotation, removeAnnotation, updateAnnotation } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (activeTool !== 'annotation') return;
    
    event.stopPropagation();
    const point = event.point.clone();
    
    addAnnotation({
      position: [point.x, point.y, point.z],
      text: `标注 ${annotations.length + 1}`,
      color: '#FF7D00',
    });
  };

  const handleStartEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleSaveEdit = (id: string) => {
    updateAnnotation(id, editText);
    setEditingId(null);
  };

  const linePoints = useMemo(() => [[0, 0, 0], [0, 1, 0]] as [number, number, number][], []);

  return (
    <group onClick={handleClick}>
      {annotations.map((annotation) => (
        <group key={annotation.id} position={annotation.position}>
          <mesh>
            <sphereGeometry args={[0.15]} />
            <meshBasicMaterial color={annotation.color} />
          </mesh>
          <Line points={linePoints} color={annotation.color} lineWidth={2} />
          <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-dark-700 px-3 py-1.5 rounded-lg shadow-lg border border-dark-600 min-w-24 pointer-events-auto">
              {editingId === annotation.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-dark-800 px-2 py-1 rounded text-sm w-24 outline-none border border-primary"
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit(annotation.id);
                    }}
                    className="text-primary hover:text-primary/80"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{annotation.text}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(annotation.id, annotation.text);
                      }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAnnotation(annotation.id);
                      }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Html>
        </group>
      ))}
      
      {activeTool === 'annotation' && (
        <Html position={[0, -1.5, 0]} center>
          <div className="bg-primary/80 px-3 py-2 rounded-lg text-sm text-white pointer-events-none">
            点击模型任意位置添加标注
          </div>
        </Html>
      )}
    </group>
  );
}
