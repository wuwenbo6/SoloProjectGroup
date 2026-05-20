import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Image,
  FolderOpen,
  Settings,
  LogOut,
  BookOpen,
  History,
} from 'lucide-react';
import useStore from '../store';

const Layout: React.FC = () => {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
    { path: '/upload', label: '图像上传', icon: Image },
    { path: '/projects', label: '项目管理', icon: FolderOpen },
    { path: '/versions', label: '版本管理', icon: History },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-amber-50">
      <aside className="w-64 bg-gradient-to-b from-amber-800 to-amber-900 text-white flex flex-col">
        <div className="p-6 border-b border-amber-700">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-amber-200" />
            <div>
              <h1 className="font-bold font-serif text-lg">古籍碑文系统</h1>
              <p className="text-xs text-amber-300">智能识别与校对</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'text-amber-200 hover:bg-amber-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-amber-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center">
              <span className="font-bold">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div>
              <p className="font-medium text-sm">{user?.username}</p>
              <p className="text-xs text-amber-300">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-amber-200 hover:bg-amber-700 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
