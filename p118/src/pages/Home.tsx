import Viewport from '@/components/Viewport';
import Toolbar from '@/components/Toolbar';
import PropertiesPanel from '@/components/PropertiesPanel';

export default function Home() {
  return (
    <div className="w-full h-full relative bg-dark-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-dark-800/80 backdrop-blur-sm border-b border-dark-600 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">工程结构分析平台</h1>
              <p className="text-gray-400 text-xs">3D可视化分析工具</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">演示模式</span>
            <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">👤</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="w-full h-full pt-16">
        <Viewport />
      </div>

      {/* Toolbar */}
      <Toolbar />

      {/* Properties Panel */}
      <PropertiesPanel />

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-dark-800/80 backdrop-blur-sm border-t border-dark-600 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>鼠标左键: 旋转</span>
            <span>鼠标右键: 平移</span>
            <span>滚轮: 缩放</span>
          </div>
          <div className="flex items-center gap-4">
            <span>模型: 钢结构演示</span>
            <span>面数: 1.2K</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              60 FPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}