'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'

export default function ActivityDetailPage() {
  const params = useParams()
  const [quantity, setQuantity] = useState(1)
  const [showBookingModal, setShowBookingModal] = useState(false)

  const activity = {
    id: params.id,
    title: '春节庙会',
    category: '节日活动',
    date: '2024年2月10日 - 2月17日',
    location: '北京市东城区地坛公园',
    price: 50,
    originalPrice: 80,
    capacity: 5000,
    enrolled: 3856,
    organizer: '北京民俗文化协会',
    description: '春节庙会是中国传统民俗文化活动，汇集了各种民间艺术表演、传统小吃、手工艺品等。本届庙会将打造沉浸式民俗体验，让游客感受浓浓的年味儿。',
    highlights: ['非遗表演', '传统小吃', '手工艺品', '祈福仪式', '花灯展示'],
    schedule: [
      { time: '09:00-10:00', event: '开园仪式' },
      { time: '10:30-11:30', event: '舞龙舞狮表演' },
      { time: '14:00-15:00', event: '民俗文艺展演' },
      { time: '18:00-20:00', event: '花灯夜游' },
    ],
    image: 'https://picsum.photos/800/400?random=21',
    images: [
      'https://picsum.photos/400/300?random=22',
      'https://picsum.photos/400/300?random=23',
      'https://picsum.photos/400/300?random=24',
    ]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-folk-red to-folk-brown text-white py-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
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
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="relative h-96">
            <Image src={activity.image} alt={activity.title} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
            <div className="absolute bottom-8 left-8 text-white">
              <span className="bg-folk-gold text-folk-brown px-4 py-1 rounded-full text-sm font-bold mb-4 inline-block">
                {activity.category}
              </span>
              <h1 className="text-4xl font-bold mb-2">{activity.title}</h1>
              <p className="text-lg opacity-90">📍 {activity.location}</p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-folk-brown mb-4">活动介绍</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">{activity.description}</p>
                  
                  <h3 className="text-xl font-bold text-folk-brown mt-6 mb-3">活动亮点</h3>
                  <div className="flex flex-wrap gap-2">
                    {activity.highlights.map((highlight, index) => (
                      <span key={index} className="bg-folk-red/10 text-folk-red px-4 py-2 rounded-full">
                        ✨ {highlight}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-folk-brown mb-4">活动日程</h2>
                  <div className="space-y-3">
                    {activity.schedule.map((item, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <span className="bg-folk-gold text-folk-brown px-4 py-2 rounded-lg font-bold min-w-fit">
                          {item.time}
                        </span>
                        <span className="text-gray-700">{item.event}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-folk-brown mb-4">精彩瞬间</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {activity.images.map((img, index) => (
                      <div key={index} className="relative h-40 rounded-lg overflow-hidden">
                        <Image src={img} alt={`活动图片${index + 1}`} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-xl p-6 sticky top-24">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-4xl font-bold text-folk-red">¥{activity.price}</span>
                      <span className="text-gray-500 line-through">¥{activity.originalPrice}</span>
                    </div>
                    <div className="text-green-600 text-sm">限时优惠，立省 ¥{activity.originalPrice - activity.price}</div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>📅 活动时间</span>
                      <span className="font-medium text-gray-800">{activity.date}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>📍 活动地点</span>
                      <span className="font-medium text-gray-800">{activity.location}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>🏛️ 主办方</span>
                      <span className="font-medium text-gray-800">{activity.organizer}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>👥 报名进度</span>
                      <span className="font-medium text-folk-red">{activity.enrolled}/{activity.capacity} 人</span>
                    </div>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                    <div 
                      className="bg-folk-red h-3 rounded-full transition-all" 
                      style={{ width: `${(activity.enrolled / activity.capacity) * 100}%` }}
                    ></div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-gray-700 mb-2 font-medium">报名人数</label>
                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 transition text-xl font-bold"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 text-center py-3 focus:outline-none font-bold text-lg"
                      />
                      <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 transition text-xl font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-folk-gold/20 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">合计金额</span>
                      <span className="text-3xl font-bold text-folk-red">¥{activity.price * quantity}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowBookingModal(true)}
                    className="w-full bg-folk-red text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition shadow-lg"
                  >
                    立即报名
                  </button>

                  <button className="w-full mt-3 border-2 border-folk-red text-folk-red py-3 rounded-xl font-bold hover:bg-folk-red/10 transition">
                    加入收藏
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-folk-brown mb-6 text-center">确认报名信息</h3>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">活动名称</span>
                <span className="font-medium">{activity.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">报名人数</span>
                <span className="font-medium">{quantity} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">单价</span>
                <span className="font-medium">¥{activity.price}</span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="font-bold text-lg">应付金额</span>
                <span className="font-bold text-2xl text-folk-red">¥{activity.price * quantity}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowBookingModal(false)}
                className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-100 transition"
              >
                取消
              </button>
              <button className="flex-1 bg-folk-red text-white py-3 rounded-xl font-bold hover:bg-red-700 transition">
                确认支付
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
