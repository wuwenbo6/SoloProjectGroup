import { useState, useEffect } from 'react';
import { User, Shield, Database, RefreshCw, Key, Save } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';

const Settings = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState('profile');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: '',
  });

  const tabs = [
    { id: 'profile', label: '个人信息', icon: User },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'api', label: 'API管理', icon: Key },
    { id: 'system', label: '系统状态', icon: Database },
  ];

  const services = [
    { name: '认证服务', port: 3001, status: 'running' },
    { name: '原料服务', port: 3002, status: 'running' },
    { name: '采集服务', port: 3003, status: 'running' },
    { name: '检测服务', port: 3004, status: 'running' },
    { name: '批次服务', port: 3005, status: 'running' },
    { name: '第三方对接', port: 3006, status: 'running' },
    { name: 'API网关', port: 3000, status: 'running' },
  ];

  const databases = [
    { name: '原料数据库', db: 'material_db', status: 'connected' },
    { name: '采集数据库', db: 'collection_db', status: 'connected' },
    { name: '检测数据库', db: 'inspection_db', status: 'connected' },
  ];

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('个人信息保存成功！');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    try {
      const response = await authAPI.refreshToken();
      useAuthStore.getState().setToken(response.data.data.accessToken);
      alert('Token刷新成功！');
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">系统设置</h1>
        <p className="text-primary-600">管理个人信息、安全设置和系统配置</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-bamboo-600 border-b-2 border-bamboo-500 bg-bamboo-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <div className="flex items-center gap-4 p-4 bg-primary-50 rounded-lg">
                <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center">
                  <User size={32} className="text-primary-700" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{user?.username}</h3>
                  <p className="text-gray-600">角色：{
                    user?.role === 'admin' ? '超级管理员' :
                    user?.role === 'material_manager' ? '原料管理员' :
                    user?.role === 'collector' ? '采集员' :
                    user?.role === 'inspector' ? '质检员' :
                    user?.role === 'batch_manager' ? '批次管理员' : '第三方机构'
                  }</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex items-center gap-2 bg-bamboo-500 text-white px-6 py-2 rounded-lg hover:bg-bamboo-600 transition-colors disabled:opacity-50"
              >
                <Save size={18} />
                {loading ? '保存中...' : '保存修改'}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">🔐 安全提示</h4>
                <p className="text-yellow-700 text-sm">建议定期更换密码，并使用强密码以确保账户安全。</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors">
                  修改密码
                </button>
                <button
                  onClick={handleRefreshToken}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw size={18} />
                  刷新Token
                </button>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">第三方机构API密钥</h3>
                <button className="flex items-center gap-2 bg-bamboo-500 text-white px-4 py-2 rounded-lg hover:bg-bamboo-600 transition-colors">
                  <Key size={18} />
                  生成新密钥
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                <p className="text-gray-600 mb-2">Webhook 回调地址：</p>
                <code className="text-primary-600">POST http://your-domain.com/api/third-party/webhook</code>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">机构名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 text-gray-900">国家造纸质量检测中心</td>
                      <td className="px-4 py-3">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">pk_live_xxxxxxxxxxxx</code>
                      </td>
                      <td className="px-4 py-3 text-gray-500">2024-01-15</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">活跃</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">微服务状态</h3>
                <div className="grid grid-cols-2 gap-4">
                  {services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-sm text-gray-500">端口: {service.port}</p>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-green-600 text-sm">运行中</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">数据库状态</h3>
                <div className="grid grid-cols-3 gap-4">
                  {databases.map((db) => (
                    <div key={db.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{db.name}</p>
                        <p className="text-sm text-gray-500">DB: {db.db}</p>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-green-600 text-sm">已连接</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <h4 className="font-medium text-primary-800 mb-2">📊 架构说明</h4>
                <ul className="text-primary-700 text-sm space-y-1">
                  <li>• 采用微服务架构，7个服务独立部署</li>
                  <li>• 数据库分库存储（原料库、采集库、检测库）</li>
                  <li>• API网关统一入口，支持限流和路由转发</li>
                  <li>• JWT无状态认证，支持角色权限控制</li>
                  <li>• Webhook机制实现第三方数据自动同步</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
