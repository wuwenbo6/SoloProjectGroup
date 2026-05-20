import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import { Wrench, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const priorityConfig = {
  low: { color: '#10b981', bgColor: '#d1fae5', label: '低' },
  medium: { color: '#f59e0b', bgColor: '#fef3c7', label: '中' },
  high: { color: '#ef4444', bgColor: '#fee2e2', label: '高' },
  critical: { color: '#7c3aed', bgColor: '#ede9fe', label: '紧急' },
};

const statusConfig = {
  pending: { color: '#6b7280', icon: Clock, label: '待处理' },
  'in-progress': { color: '#f59e0b', icon: Wrench, label: '进行中' },
  completed: { color: '#10b981', icon: CheckCircle2, label: '已完成' },
};

export default function RepairNotes() {
  const { repair, setSelectedRepairNote, toggleInspectionPoint } = useStore();

  if (!repair.enabled) return null;

  return (
    <group>
      {repair.notes.map((note) => {
        const priority = priorityConfig[note.priority];
        const status = statusConfig[note.status];
        const StatusIcon = status.icon;
        const isSelected = repair.selectedNoteId === note.id;

        return (
          <group key={note.id} position={note.position}>
            {/* 3D Marker */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRepairNote(isSelected ? null : note.id);
              }}
            >
              <coneGeometry args={[0.3, 0.8, 8]} />
              <meshBasicMaterial color={priority.color} />
            </mesh>

            {/* Base ring */}
            <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.4, 32]} />
              <meshBasicMaterial
                color={priority.color}
                side={2}
                transparent
                opacity={0.5}
              />
            </mesh>

            {/* Info Card */}
            <Html position={[0, 1.2, 0]} center zIndexRange={[50, 0]}>
              <div
                className={`bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 shadow-xl border-2 transition-all cursor-pointer min-w-56 ${
                  isSelected ? 'border-white scale-105' : 'border-gray-700 hover:border-gray-500'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRepairNote(isSelected ? null : note.id);
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wrench size={14} style={{ color: priority.color }} />
                    <span className="text-white font-medium text-sm">{note.title}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: priority.bgColor, color: priority.color }}
                  >
                    {priority.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                  {note.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <StatusIcon size={12} style={{ color: status.color }} />
                    <span
                      className="text-xs font-medium"
                      style={{ color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    👤 {note.assignee}
                  </span>
                </div>

                {/* Expanded details */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">创建日期</span>
                        <p className="text-white">{note.createdAt}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">负责人</span>
                        <p className="text-white">{note.assignee}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Toggle completion
                        }}
                      >
                        标记完成
                      </button>
                      <button
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-1.5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
