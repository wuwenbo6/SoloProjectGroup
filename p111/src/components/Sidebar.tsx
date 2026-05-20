import { Activity, Bell, Clock, Wifi, WifiOff, Sparkles, AlertTriangle, Layers } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMonitorStore } from '../store/monitorStore';

export const Sidebar = () => {
  const location = useLocation();
  const { isConnected, getUnacknowledgedCount } = useMonitorStore();
  const unreadCount = getUnacknowledgedCount();

  const navItems = [
    { path: '/dashboard', label: '监控控制台', icon: Activity },
    { path: '/intelligence', label: '智能分析', icon: Sparkles },
    { path: '/root-cause', label: '根因分析', icon: AlertTriangle },
    { path: '/devices', label: '多设备对比', icon: Layers },
    { path: '/alerts', label: '告警中心', icon: Bell, badge: unreadCount },
    { path: '/history', label: '历史查询', icon: Clock },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">发酵监控系统</h1>
            <p className="text-xs text-slate-500">Fermentation Monitor</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-xl">
          {isConnected ? (
            <Wifi className="w-5 h-5 text-emerald-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              {isConnected ? '已连接' : '连接中...'}
            </p>
            <p className="text-xs text-slate-500">
              {isConnected ? '数据实时同步' : '正在重连'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
