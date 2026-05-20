
import { NavLink } from 'react-router-dom';
import { Gauge, Bell, History, Activity, Brain, Search, BarChart3 } from 'lucide-react';

export const Sidebar = () => {
    const navItems = [
        { path: '/dashboard', label: '监控面板', icon: Gauge },
        { path: '/analytics', label: '智能分析', icon: Brain },
        { path: '/anomaly', label: '异常诊断', icon: Search },
        { path: '/batches', label: '批次对比', icon: BarChart3 },
        { path: '/alerts', label: '告警中心', icon: Bell },
        { path: '/history', label: '历史数据', icon: History },
    ];

    return (
        <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col">
            <div className="p-6 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-xl">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">环境监测</h1>
                        <p className="text-sm text-slate-400">IoT Monitoring</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                            isActive
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="p-4 border-t border-slate-700">
                <div className="text-center text-sm text-slate-500">
                    <p>v1.0.0</p>
                </div>
            </div>
        </aside>
    );
};

