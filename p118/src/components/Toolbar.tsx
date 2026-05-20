import { Box, Tag, Rust, Activity, Scissors, Route, Wrench, History as HistoryIcon, Glasses } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Toolbar() {
  const {
    activeTool, setActiveTool,
    corrosion, stress, section, inspection, repair, history, vr,
    setCorrosionEnabled, setStressEnabled, setSectionEnabled,
    setInspectionEnabled, setRepairEnabled, setHistoryEnabled, setVrEnabled
  } = useStore();

  const tools = [
    { id: 'model', icon: Box, label: '模型加载', color: 'text-blue-400' },
    { id: 'annotation', icon: Tag, label: '构件标注', color: 'text-orange-400' },
    { id: 'corrosion', icon: Rust, label: '腐蚀查看', color: 'text-amber-600', enabled: corrosion.enabled },
    { id: 'stress', icon: Activity, label: '受力模拟', color: 'text-red-400', enabled: stress.enabled },
    { id: 'section', icon: Scissors, label: '截面查看', color: 'text-cyan-400', enabled: section.enabled },
    { id: 'inspection', icon: Route, label: '自动巡检', color: 'text-green-400', enabled: inspection.enabled },
    { id: 'repair', icon: Wrench, label: '维修标注', color: 'text-yellow-400', enabled: repair.enabled },
    { id: 'history', icon: HistoryIcon, label: '版本对比', color: 'text-purple-400', enabled: history.enabled },
    { id: 'vr', icon: Glasses, label: 'VR模式', color: 'text-pink-400', enabled: vr.enabled },
  ];

  const handleToolClick = (toolId: string) => {
    const isActive = activeTool === toolId;
    const newState = isActive ? null : (toolId as any);
    setActiveTool(newState);
    
    // Toggle feature enabled state
    if (toolId === 'corrosion') setCorrosionEnabled(!isActive);
    if (toolId === 'stress') setStressEnabled(!isActive);
    if (toolId === 'section') setSectionEnabled(!isActive);
    if (toolId === 'inspection') setInspectionEnabled(!isActive);
    if (toolId === 'repair') setRepairEnabled(!isActive);
    if (toolId === 'history') setHistoryEnabled(!isActive);
    if (toolId === 'vr') setVrEnabled(!isActive);
  };

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
      <div className="bg-gray-800/90 backdrop-blur-sm p-2 rounded-xl border border-gray-700 shadow-xl">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 group relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? '' : tool.color}`} />
              {tool.enabled && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
              <span className="absolute left-full ml-3 px-2 py-1 bg-gray-700 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
