'use client'
import { useState } from 'react'
import Link from 'next/link'

const ordersData = [
  { id: 'ORD001', activity: '春节庙会', user: '张三', phone: '138****1234', amount: 50, status: '已支付', createTime: '2024-01-15 10:30' },
  { id: 'ORD002', activity: '龙舟竞渡', user: '李四', phone: '139****5678', amount: 200, status: '待支付', createTime: '2024-01-15 11:20' },
  { id: 'ORD003', activity: '中秋赏月', user: '王五', phone: '137****9012', amount: 160, status: '已取消', createTime: '2024-01-14 09:15' },
  { id: 'ORD004', activity: '舞狮表演', user: '赵六', phone: '136****3456', amount: 120, status: '已支付', createTime: '2024-01-14 14:45' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderDashboard = () => (
    <div>
      <h2 className="text-2xl font-bold text-folk-brown mb-6">数据概览</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: '今日订单', value: '28', change: '+12%', color: 'bg-blue-500' },
          { label: '活动总数', value: '156', change: '+5%', color: 'bg-green-500' },
          { label: '注册用户', value: '3,456', change: '+8%', color: 'bg-purple-500' },
          { label: '今日收入', value: '¥8,920', change: '+15%', color: 'bg-folk-red' },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-lg p-6">
            <div className={`${stat.color} text-white w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
              <span className="text-xl">📊</span>
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
            <div className="text-gray-600">{stat.label}</div>
            <div className="text-green-500 text-sm mt-2">{stat.change} 较昨日</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-folk-brown mb-4">最新订单</h3>
          <div className="space-y-4">
            {ordersData.slice(0, 3).map(order => (
              <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-bold">{order.id}</div>
                  <div className="text-sm text-gray-600">{order.activity}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-folk-red">¥{order.amount}</div>
                  <div className={`text-sm ${order.status === '已支付' ? 'text-green-500' : order.status === '待支付' ? 'text-yellow-500' : 'text-gray-500'}`}>
                    {order.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-folk-brown mb-4">待审核资质</h3>
          <div className="space-y-4">
            {[
              { name: '孙七', type: '活动主办方', time: '2小时前' },
              { name: '周八', type: '志愿者', time: '5小时前' },
              { name: '吴九', type: '摄影师', time: '1天前' },
            ].map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-sm text-gray-600">{item.type}</div>
                </div>
                <div className="text-sm text-gray-500">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderOrders = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-folk-brown">订单管理</h2>
        <button className="bg-folk-red text-white px-6 py-2 rounded-lg hover:bg-red-700 transition">
          导出数据
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-folk-brown text-white">
            <tr>
              <th className="px-6 py-4 text-left">订单号</th>
              <th className="px-6 py-4 text-left">活动</th>
              <th className="px-6 py-4 text-left">用户</th>
              <th className="px-6 py-4 text-left">金额</th>
              <th className="px-6 py-4 text-left">状态</th>
              <th className="px-6 py-4 text-left">创建时间</th>
              <th className="px-6 py-4 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {ordersData.map(order => (
              <tr key={order.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-bold">{order.id}</td>
                <td className="px-6 py-4">{order.activity}</td>
                <td className="px-6 py-4">{order.user}<br/><span className="text-sm text-gray-500">{order.phone}</span></td>
                <td className="px-6 py-4 font-bold text-folk-red">¥{order.amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${order.status === '已支付' ? 'bg-green-100 text-green-700' : order.status === '待支付' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4">{order.createTime}</td>
                <td className="px-6 py-4">
                  <button className="text-folk-red hover:underline">查看</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gradient-to-b from-folk-brown to-folk-red text-white min-h-screen">
        <div className="p-6">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <span className="text-folk-gold">🎭</span>
            管理后台
          </Link>
        </div>
        <nav className="mt-4">
          {[
            { id: 'dashboard', label: '数据概览', icon: '📊' },
            { id: 'orders', label: '订单管理', icon: '📦' },
            { id: 'activities', label: '活动管理', icon: '🎫' },
            { id: 'audit', label: '资质审核', icon: '✅' },
            { id: 'users', label: '用户管理', icon: '👥' },
            { id: 'messages', label: '消息推送', icon: '📨' },
            { id: 'settings', label: '系统设置', icon: '⚙️' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full px-6 py-3 text-left flex items-center gap-3 transition ${activeTab === item.id ? 'bg-white/20 border-l-4 border-folk-gold' : 'hover:bg-white/10'}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8 bg-gray-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-folk-brown">活动报名操作台</h1>
          <div className="flex items-center gap-4">
            <button className="relative p-2 bg-white rounded-full shadow">
              <span>🔔</span>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow">
              <span>👤</span>
              <span>管理员</span>
            </div>
          </div>
        </div>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'orders' && renderOrders()}
      </main>
    </div>
  )
}
