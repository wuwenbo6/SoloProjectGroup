'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const activitiesData = [
  { id: 1, title: '春节庙会', category: '节日', date: '2024-02-10', location: '北京地坛', price: 50, status: '报名中', image: 'https://picsum.photos/400/250?random=11' },
  { id: 2, title: '龙舟竞渡', category: '竞技', date: '2024-06-10', location: '杭州西湖', price: 100, status: '报名中', image: 'https://picsum.photos/400/250?random=12' },
  { id: 3, title: '中秋赏月', category: '节日', date: '2024-09-17', location: '南京秦淮河', price: 80, status: '报名中', image: 'https://picsum.photos/400/250?random=13' },
  { id: 4, title: '剪纸艺术展', category: '艺术', date: '2024-03-15', location: '上海博物馆', price: 30, status: '已结束', image: 'https://picsum.photos/400/250?random=14' },
  { id: 5, title: '舞狮表演', category: '表演', date: '2024-05-01', location: '广州天河', price: 60, status: '报名中', image: 'https://picsum.photos/400/250?random=15' },
  { id: 6, title: '古琴音乐会', category: '音乐', date: '2024-04-20', location: '成都武侯祠', price: 120, status: '名额已满', image: 'https://picsum.photos/400/250?random=16' },
]

const categories = ['全部', '节日', '竞技', '艺术', '表演', '音乐']

export default function ActivitiesPage() {
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredActivities = activitiesData.filter(activity => {
    const matchCategory = selectedCategory === '全部' || activity.category === selectedCategory
    const matchSearch = activity.title.includes(searchTerm) || activity.location.includes(searchTerm)
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen">
      <nav className="bg-gradient-to-r from-folk-red to-folk-brown text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <span className="text-folk-gold">🎭</span>
            民俗活动平台
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-folk-gold transition">首页</Link>
            <Link href="/activities" className="text-folk-gold font-bold">活动展示</Link>
            <Link href="/admin" className="hover:text-folk-gold transition">操作台</Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-folk-brown mb-8 text-center">民俗活动展示</h1>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="搜索活动名称或地点..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-folk-red focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full transition ${selectedCategory === category ? 'bg-folk-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map(activity => (
            <div key={activity.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
              <div className="relative h-48">
                <Image src={activity.image} alt={activity.title} fill className="object-cover" />
                <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-bold ${activity.status === '报名中' ? 'bg-green-500 text-white' : activity.status === '已结束' ? 'bg-gray-500 text-white' : 'bg-yellow-500 text-white'}`}>
                  {activity.status}
                </span>
              </div>
              <div className="p-6">
                <span className="inline-block bg-folk-gold text-folk-brown px-3 py-1 rounded-full text-sm font-bold mb-2">
                  {activity.category}
                </span>
                <h3 className="text-xl font-bold text-folk-brown mb-2">{activity.title}</h3>
                <p className="text-gray-600 mb-1">📅 {activity.date}</p>
                <p className="text-gray-600 mb-3">📍 {activity.location}</p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-folk-red">¥{activity.price}</span>
                  <Link href={`/activities/${activity.id}`} className="bg-folk-red text-white px-6 py-2 rounded-full hover:bg-red-700 transition">
                    立即报名
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="bg-folk-brown text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-folk-gold">© 2024 民俗活动平台 版权所有</p>
        </div>
      </footer>
    </div>
  )
}
