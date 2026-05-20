import React, { useState, useEffect } from 'react'
import { Camera, Image, Sparkles, Users, ChevronRight, Clock, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    materials: 128,
    features: 89,
    patterns: 45,
    users: 12,
  })

  const recentActivities = [
    { id: 1, user: '张三', action: '上传了苗族蜡染纹样', time: '5分钟前' },
    { id: 2, user: '李四', action: '提取了云纹特征', time: '15分钟前' },
    { id: 3, user: '王五', action: '生成了新图案', time: '1小时前' },
    { id: 4, user: '赵六', action: '编辑了水纹纹样', time: '2小时前' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-indigo-dark">
          欢迎回来
        </h1>
        <p className="text-gray-500 mt-2">
          这里是传统纹样数字化平台的控制面板
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card border-l-4 border-l-indigo-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">纹样素材</p>
              <p className="text-3xl font-bold text-indigo-dark mt-1">{stats.materials}</p>
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <TrendingUp size={14} />
                +12 本周
              </p>
            </div>
            <div className="w-14 h-14 bg-indigo-dark/10 rounded-2xl flex items-center justify-center">
              <Image className="text-indigo-dark" size={28} />
            </div>
          </div>
          <Link to="/materials" className="mt-4 flex items-center text-sm text-indigo-dark hover:underline">
            查看全部 <ChevronRight size={16} />
          </Link>
        </div>

        <div className="card border-l-4 border-l-gold-earth">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">已提取特征</p>
              <p className="text-3xl font-bold text-gold-earth mt-1">{stats.features}</p>
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <TrendingUp size={14} />
                +8 本周
              </p>
            </div>
            <div className="w-14 h-14 bg-gold-earth/10 rounded-2xl flex items-center justify-center">
              <Camera className="text-gold-earth" size={28} />
            </div>
          </div>
          <Link to="/materials" className="mt-4 flex items-center text-sm text-gold-earth hover:underline">
            查看全部 <ChevronRight size={16} />
          </Link>
        </div>

        <div className="card border-l-4 border-l-red-vermilion">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">生成图案</p>
              <p className="text-3xl font-bold text-red-vermilion mt-1">{stats.patterns}</p>
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <TrendingUp size={14} />
                +5 本周
              </p>
            </div>
            <div className="w-14 h-14 bg-red-vermilion/10 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-red-vermilion" size={28} />
            </div>
          </div>
          <Link to="/generator" className="mt-4 flex items-center text-sm text-red-vermilion hover:underline">
            查看全部 <ChevronRight size={16} />
          </Link>
        </div>

        <div className="card border-l-4 border-l-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">平台用户</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats.users}</p>
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <TrendingUp size={14} />
                +2 本周
              </p>
            </div>
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Users className="text-gray-600" size={28} />
            </div>
          </div>
          <Link to="/users" className="mt-4 flex items-center text-sm text-gray-600 hover:underline">
            查看全部 <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-serif font-bold text-indigo-dark mb-6">快速操作</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/capture" className="p-6 bg-gradient-to-br from-indigo-dark to-indigo-800 text-white rounded-xl text-center hover:shadow-lg transition-shadow">
              <Camera size={32} className="mx-auto mb-3" />
              <span className="font-medium">纹样采集</span>
            </Link>
            <Link to="/materials" className="p-6 bg-gradient-to-br from-gold-earth to-yellow-700 text-white rounded-xl text-center hover:shadow-lg transition-shadow">
              <Image size={32} className="mx-auto mb-3" />
              <span className="font-medium">素材库</span>
            </Link>
            <Link to="/generator" className="p-6 bg-gradient-to-br from-red-vermilion to-red-700 text-white rounded-xl text-center hover:shadow-lg transition-shadow">
              <Sparkles size={32} className="mx-auto mb-3" />
              <span className="font-medium">图案生成</span>
            </Link>
            <Link to="/users" className="p-6 bg-gradient-to-br from-gray-600 to-gray-700 text-white rounded-xl text-center hover:shadow-lg transition-shadow">
              <Users size={32} className="mx-auto mb-3" />
              <span className="font-medium">用户管理</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-serif font-bold text-indigo-dark mb-6">最近活动</h2>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="w-8 h-8 bg-gold-earth/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock size={14} className="text-gold-earth" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-indigo-dark">{activity.user}</span>
                    {' '}{activity.action}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
