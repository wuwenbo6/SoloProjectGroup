import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Leaf, 
  FileText, 
  History, 
  LogOut,
  TreePine,
  Target,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/data-import', label: '数据导入', icon: FileSpreadsheet },
  { path: '/targets', label: '目标管理', icon: Target },
  { path: '/benchmark', label: '对标分析', icon: BarChart3 },
  { path: '/reduction', label: '减排建议', icon: Leaf },
  { path: '/reports', label: '报告中心', icon: FileText },
  { path: '/history', label: '历史数据', icon: History },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-gradient-to-b from-emerald-900 to-emerald-800 min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-emerald-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <TreePine className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">碳管理系统</h1>
            <p className="text-emerald-300 text-xs">Carbon Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'text-emerald-100 hover:bg-emerald-700/50 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-emerald-700">
        <div className="mb-4 px-4">
          <p className="text-emerald-200 text-sm font-medium truncate">
            {user?.company_name}
          </p>
          <p className="text-emerald-400 text-xs">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700/50 text-emerald-100 rounded-lg hover:bg-emerald-600 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
}
