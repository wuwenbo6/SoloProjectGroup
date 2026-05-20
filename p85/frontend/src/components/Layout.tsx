import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Leaf,
  ClipboardList,
  Microscope,
  Package,
  Settings,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
    { path: '/materials', icon: Leaf, label: '原料管理' },
    { path: '/collection', icon: ClipboardList, label: '采集管理' },
    { path: '/inspection', icon: Microscope, label: '品质检测' },
    { path: '/batches', icon: Package, label: '批次管理' },
    { path: '/settings', icon: Settings, label: '系统设置' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: '管理员',
      material_manager: '原料管理员',
      collector: '采集员',
      inspector: '质检员',
      batch_manager: '批次管理员',
      third_party: '第三方机构',
    };
    return roles[role] || role;
  };

  return (
    <div className="min-h-screen bg-primary-50 bg-pattern flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-primary-700 to-primary-800 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <div className="p-4 border-b border-primary-600">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold font-serif">古法造纸溯源</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gold-500 text-primary-900 font-semibold shadow-lg'
                    : 'hover:bg-primary-600 text-primary-100'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-600">
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
              <User size={20} />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.username}</p>
                <p className="text-sm text-primary-300 truncate">{getRoleLabel(user?.role || '')}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-3 w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors text-red-300 hover:text-red-200 ${
              sidebarOpen ? '' : 'justify-center'
            }`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>退出登录</span>}
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
