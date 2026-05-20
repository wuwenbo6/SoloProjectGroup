'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Rating {
  id: number
  userId: number
  userName: string
  userAvatar: string
  rating: number
  content: string
  images?: string[]
  likeCount: number
  createTime: string
  reply?: string
}

export default function RatingPage() {
  const params = useParams()
  const activityId = params.id as string

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [stats, setStats] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activityName, setActivityName] = useState('')

  useEffect(() => {
    fetchRatingStats()
    fetchRatings()
    fetchActivityInfo()
  }, [activityId])

  const fetchActivityInfo = async () => {
    try {
      const res = await fetch(`/api/activity/${activityId}`)
      const data = await res.json()
      if (data.code === 200) {
        setActivityName(data.data?.name || '')
      }
    } catch (e) {
      console.error('获取活动信息失败', e)
    }
  }

  const fetchRatingStats = async () => {
    try {
      const res = await fetch(`/api/rating/stats/${activityId}`)
      const data = await res.json()
      if (data.code === 200) {
        setStats(data.data)
      }
    } catch (e) {
      console.error('获取评分统计失败', e)
    }
  }

  const fetchRatings = async () => {
    try {
      const res = await fetch(`/api/rating/list/${activityId}`)
      const data = await res.json()
      if (data.code === 200) {
        setRatings(data.data || [])
      }
    } catch (e) {
      console.error('获取评价列表失败', e)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('请输入评价内容')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/rating/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: parseInt(activityId),
          userId: 1,
          userName: '测试用户',
          rating,
          content,
          images
        })
      })

      const data = await res.json()
      if (data.code === 200) {
        alert('评价成功！')
        setContent('')
        setRating(5)
        setImages([])
        fetchRatingStats()
        fetchRatings()
      } else {
        alert(data.message || '评价失败')
      }
    } catch (e) {
      alert('评价失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (ratingId: number) => {
    try {
      await fetch(`/api/rating/like/${ratingId}`, { method: 'POST' })
      setRatings(ratings.map(r => 
        r.id === ratingId ? { ...r, likeCount: r.likeCount + 1 } : r
      ))
    } catch (e) {
      console.error('点赞失败', e)
    }
  }

  const renderStars = (count: number, interactive = false, onSelect?: (v: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110 transition' : ''}`}
            onClick={() => interactive && onSelect && onSelect(i)}
          >
            {i <= count ? '★' : '☆'}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-red-700 to-red-800 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href={`/activities/${activityId}`} className="flex items-center gap-2">
            <span>←</span> 返回活动详情
          </Link>
          <h1 className="text-xl font-bold">活动评价</h1>
          <div className="w-20"></div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-red-800 mb-4">发表评价</h2>
          <p className="text-gray-600 mb-4">{activityName}</p>
          
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">评分</label>
            <div className="flex items-center gap-4">
              {renderStars(rating, true, setRating)}
              <span className="text-red-600 font-bold text-xl">{rating} 分</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">评价内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="分享您的体验，帮助其他用户做出选择..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent h-32 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition disabled:bg-gray-400"
          >
            {submitting ? '提交中...' : '提交评价'}
          </button>
        </div>

        {stats && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-red-800 mb-4">评分统计</h2>
            <div className="flex items-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-red-600">{stats.avgRating || 0}</div>
                <div className="flex justify-center mt-2">
                  {renderStars(Math.round(stats.avgRating || 0))}
                </div>
                <div className="text-gray-500 mt-1">共 {stats.totalCount} 条评价</div>
              </div>
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = stats.ratingDistribution?.[star] || 0
                  const percent = stats.totalCount > 0 ? (count / stats.totalCount * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2 mb-1">
                      <span className="w-8 text-right">{star}星</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-yellow-500 h-3 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-12 text-gray-600 text-sm">{count}人</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-4">全部评价 ({ratings.length})</h2>
          
          {ratings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl">📝</span>
              <p className="mt-4">暂无评价，快来抢沙发吧！</p>
            </div>
          ) : (
            <div className="space-y-6">
              {ratings.map(item => (
                <div key={item.id} className="border-b border-gray-100 pb-6 last:border-0">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-800">{item.userName}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-yellow-500">
                              {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {new Date(item.createTime).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700 mt-3 leading-relaxed">{item.content}</p>
                      
                      {item.images && item.images.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {item.images.map((img, idx) => (
                            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                              <Image src={img} alt="" fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {item.reply && (
                        <div className="mt-4 bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                          <div className="text-yellow-700 font-medium text-sm mb-1">商家回复</div>
                          <p className="text-gray-700">{item.reply}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={() => handleLike(item.id)}
                          className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition"
                        >
                          <span>👍</span>
                          <span>{item.likeCount || 0}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
