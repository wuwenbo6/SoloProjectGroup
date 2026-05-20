import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, Camera, Edit3, Sparkles, Users, Image, LogOut, User 
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: Home, label: '仪表盘' },
    { path: '/capture', icon: Camera, label: '纹样采集', roles: ['collector', 'designer', 'admin'] },
    { path: '/materials', icon: Image, label: '素材库' },
    { path: '/generator', icon: Sparkles, label: '图案生成', roles: ['designer', 'admin'] },
    { path: '/users', icon: Users, label: '用户管理', roles: ['admin'] },
  ]

  const isNavVisible = (roles?: string[]) => {
    if (!roles) return true
    return user ? roles.includes(user.role) : false
  }

  return (
    <div className="flex h-screen bg-paper-white">
      <aside className="w-64 bg-indigo-dark text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-serif font-bold text-gold-earth">
            传统纹样数字化平台
          </h1>
          <p className="text-sm text-white/60 mt-1">Ethnic Pattern Digital</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            isNavVisible(item.roles) && (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-red-vermilion text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gold-earth flex items-center justify-center">
              <User size={20} className="text-indigo-dark" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{user?.username}</p>
              <p className="text-xs text-white/60">
                {user?.role === 'admin' ? '管理员' : 
                 user?.role === 'designer' ? '设计师' : '采集员'}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout
