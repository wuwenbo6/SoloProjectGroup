import { MousePointer2, Circle, Settings2, Trash2, Zap, Users } from 'lucide-react';
import { ToolType, LoadType, USER_COLORS } from '@/types';
import { useGameStore } from '@/store/useGameStore';

const tools: { type: ToolType; icon: typeof MousePointer2; label: string }[] = [
  { type: 'select', icon: MousePointer2, label: '选择' },
  { type: 'waterwheel', icon: Circle, label: '水车' },
  { type: 'gear', icon: Settings2, label: '齿轮' },
  { type: 'load', icon: Zap, label: '负载' },
  { type: 'delete', icon: Trash2, label: '删除' },
];

const loadTypes: { type: LoadType; icon: string; label: string }[] = [
  { type: 'generator', icon: '⚡', label: '发电机' },
  { type: 'millstone', icon: '🌾', label: '磨盘' },
  { type: 'pump', icon: '💧', label: '水泵' },
  { type: 'conveyor', icon: '⚙️', label: '传送带' },
];

export function Toolbar() {
  const {
    selectedTool,
    setSelectedTool,
    selectedLoadType,
    setSelectedLoadType,
    currentUser,
    allUsers,
    switchUser,
    toggleUserOnline,
    showCollaborationPanel,
    setShowCollaborationPanel,
  } = useGameStore();

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 bg-slate-800/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-700">
      <h3 className="text-white font-semibold mb-1 text-center text-sm">工具</h3>
      
      {tools.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => setSelectedTool(type)}
          className={`flex items-center gap-2 p-3 rounded-lg transition-all duration-200 ${
            selectedTool === type
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
          }`}
          title={label}
        >
          <Icon size={18} />
          <span className="text-sm font-medium">{label}</span>
        </button>
      ))}

      {selectedTool === 'load' && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <p className="text-slate-400 text-xs mb-2">选择负载类型:</p>
          <div className="grid grid-cols-2 gap-1">
            {loadTypes.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => setSelectedLoadType(type)}
                className={`p-2 rounded-lg text-center transition-all ${
                  selectedLoadType === type
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title={label}
              >
                <span className="text-lg">{icon}</span>
                <div className="text-xs mt-1">{label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-slate-700">
        <button
          onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
          className="flex items-center gap-2 w-full p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
        >
          <Users size={18} />
          <span className="text-sm font-medium">协作</span>
        </button>
      </div>

      {showCollaborationPanel && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <p className="text-slate-400 text-xs mb-2">切换用户:</p>
          <div className="space-y-1">
            {allUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-all ${
                  currentUser.id === user.id
                    ? 'bg-blue-600/50 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: USER_COLORS[user.color] || '#888' }}
                />
                <span className="flex-1 text-left">{user.name}</span>
                <span className="text-xs text-slate-500">
                  {user.objectsCreated}个
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUserOnline(user.id);
                  }}
                  className={`w-2 h-2 rounded-full ${
                    user.online ? 'bg-green-400' : 'bg-slate-500'
                  }`}
                  title={user.online ? '在线' : '离线'}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
