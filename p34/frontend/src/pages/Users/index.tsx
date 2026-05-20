import React, { useState } from 'react'
import {
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  Shield,
  Eye,
  ChevronDown,
  Clock,
  Download,
} from 'lucide-react'

const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  const users = [
    {
      id: '1',
      username: '管理员',
      email: 'admin@pattern.com',
      role: 'admin',
      status: 'active',
      avatar: 'https://picsum.photos/40/40?random=40',
      lastLogin: '2024-01-15 14:30',
      createdAt: '2024-01-01',
      permissions: { materials: true, features: true, generator: true, users: true },
    },
    {
      id: '2',
      username: '张三',
      email: 'zhang@pattern.com',
      role: 'designer',
      status: 'active',
      avatar: 'https://picsum.photos/40/40?random=41',
      lastLogin: '2024-01-15 10:20',
      createdAt: '2024-01-05',
      permissions: { materials: true, features: true, generator: true, users: false },
    },
    {
      id: '3',
      username: '李四',
      email: 'li@pattern.com',
      role: 'designer',
      status: 'active',
      avatar: 'https://picsum.photos/40/40?random=42',
      lastLogin: '2024-01-14 16:45',
      createdAt: '2024-01-06',
      permissions: { materials: true, features: true, generator: true, users: false },
    },
    {
      id: '4',
      username: '王五',
      email: 'wang@pattern.com',
      role: 'collector',
      status: 'active',
      avatar: 'https://picsum.photos/40/40?random=43',
      lastLogin: '2024-01-15 09:15',
      createdAt: '2024-01-08',
      permissions: { materials: true, features: false, generator: false, users: false },
    },
    {
      id: '5',
      username: '赵六',
      email: 'zhao@pattern.com',
      role: 'collector',
      status: 'inactive',
      avatar: 'https://picsum.photos/40/40?random=44',
      lastLogin: '2024-01-10 11:30',
      createdAt: '2024-01-10',
      permissions: { materials: true, features: false, generator: false, users: false },
    },
    {
      id: '6',
      username: '钱七',
      email: 'qian@pattern.com',
      role: 'collector',
      status: 'banned',
      avatar: 'https://picsum.photos/40/40?random=45',
      lastLogin: '2024-01-05 08:00',
      createdAt: '2024-01-03',
      permissions: { materials: false, features: false, generator: false, users: false },
    },
  ]

  const operationLogs = [
    { id: '1', user: '张三', action: '上传纹样', target: '苗族蜡染云纹', time: '2024-01-15 14:30:25', ip: '192.168.1.100' },
    { id: '2', user: '李四', action: '提取特征', target: '彝族刺绣花卉', time: '2024-01-15 14:25:18', ip: '192.168.1.101' },
    { id: '3', user: '王五', action: '上传纹样', target: '壮族织锦几何纹', time: '2024-01-15 14:20:33', ip: '192.168.1.102' },
    { id: '4', user: '管理员', action: '修改权限', target: '王五 - 采集员', time: '2024-01-15 14:15:00', ip: '192.168.1.1' },
    { id: '5', user: '李四', action: '生成图案', target: '组合图案 #0023', time: '2024-01-15 14:10:45', ip: '192.168.1.101' },
    { id: '6', user: '张三', action: '编辑纹样', target: '傣族水纹图案', time: '2024-01-15 14:05:20', ip: '192.168.1.100' },
  ]

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; class: string }> = {
      admin: { label: '管理员', class: 'bg-purple-100 text-purple-700' },
      designer: { label: '设计师', class: 'bg-blue-100 text-blue-700' },
      collector: { label: '采集员', class: 'bg-green-100 text-green-700' },
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roles[role].class}`}>
        {roles[role].label}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; class: string }> = {
      active: { label: '正常', class: 'bg-green-100 text-green-700' },
      inactive: { label: '未激活', class: 'bg-gray-100 text-gray-700' },
      banned: { label: '已禁用', class: 'bg-red-100 text-red-700' },
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statuses[status].class}`}>
        {statuses[status].label}
      </span>
    )
  }

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = selectedRole === 'all' || user.role === selectedRole
    const matchStatus = selectedStatus === 'all' || user.status === selectedStatus
    return matchSearch && matchRole && matchStatus
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-indigo-dark">用户管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理系统用户、角色权限和操作日志</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          添加用户
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-dark/10 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-indigo-dark" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{users.length}</p>
              <p className="text-sm text-gray-500">总用户数</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {users.filter((u) => u.role === 'admin').length}
              </p>
              <p className="text-sm text-gray-500">管理员</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {users.filter((u) => u.role === 'designer').length}
              </p>
              <p className="text-sm text-gray-500">设计师</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gold-earth/10 rounded-xl flex items-center justify-center">
              <Eye size={24} className="text-gold-earth" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {users.filter((u) => u.status === 'active').length}
              </p>
              <p className="text-sm text-gray-500">活跃用户</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="搜索用户名、邮箱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
              />
            </div>
          </div>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
          >
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="designer">设计师</option>
            <option value="collector">采集员</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="inactive">未激活</option>
            <option value="banned">已禁用</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最后登录
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.lastLogin}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg" title="编辑">
                        <Edit3 size={18} className="text-gold-earth" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg" title="删除">
                        <Trash2 size={18} className="text-red-vermilion" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-medium text-indigo-dark flex items-center gap-2">
            <Clock size={20} />
            操作日志
          </h3>
          <button className="text-sm text-gold-earth hover:underline flex items-center gap-1">
            <Download size={16} />
            导出日志
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  时间
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  目标
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP地址
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operationLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{log.time}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{log.user}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-dark/10 text-indigo-dark rounded-full text-xs">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.target}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default UsersPage
