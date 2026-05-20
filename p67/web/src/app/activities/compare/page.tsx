'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Activity {
  id: number
  name: string
  category: string
  coverImage: string
  price: number
  location: string
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  requirements: string[]
  processSteps: string[]
  highlights: string[]
  rating: number
  ratingCount: number
}

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [compareData, setCompareData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity/list')
      const data = await res.json()
      if (data.code === 200) {
        setActivities(data.data || [])
      }
    } catch (e) {
      console.error('获取活动列表失败', e)
    }
  }

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id])
    }
  }

  const doCompare = async () => {
    if (selectedIds.length < 2) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/activity/compare?activityIds=${selectedIds.join(',')}`)
      const data = await res.json()
      if (data.code === 200) {
        setCompareData(data.data)
      }
    } catch (e) {
      console.error('对比失败', e)
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '-'
    
    switch (type) {
      case 'currency':
        return `¥${value}`
      case 'date':
        return new Date(value).toLocaleDateString('zh-CN')
      case 'list':
        return Array.isArray(value) ? value.map((v, i) => (
          <div key={i} className="py-1">{i + 1}. {v}</div>
        )) : '-'
      case 'rating':
        return (
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            <span>{value || 0}</span>
          </div>
        )
      default:
        return value
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-red-700 to-red-800 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href="/activities" className="text-xl font-bold flex items-center gap-2">
            <span>🎭</span> 民俗活动平台
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-yellow-300 transition">首页</Link>
            <Link href="/activities" className="text-yellow-300 font-bold">活动列表</Link>
            <Link href="/admin" className="hover:text-yellow-300 transition">操作台</Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h1 className="text-2xl font-bold text-red-800 mb-4">活动方案对比</h1>
          <p className="text-gray-600 mb-4">请选择2-3个活动进行对比，比较报名要求、流程等信息</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {activities.map(activity => (
              <div
                key={activity.id}
                onClick={() => toggleSelect(activity.id)}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${
                  selectedIds.includes(activity.id)
                    ? 'border-red-600 ring-2 ring-red-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="relative h-32">
                  <Image
                    src={activity.coverImage || `https://picsum.photos/400/200?random=${activity.id}`}
                    alt={activity.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-gray-800 text-sm truncate">{activity.name}</h3>
                  <p className="text-red-600 font-bold mt-1">¥{activity.price}</p>
                </div>
                {selectedIds.includes(activity.id) && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-600">已选择 {selectedIds.length}/3 个活动</span>
            <button
              onClick={doCompare}
              disabled={selectedIds.length < 2 || loading}
              className={`px-6 py-2 rounded-lg font-bold transition ${
                selectedIds.length >= 2 && !loading
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? '对比中...' : '开始对比'}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              清除选择
            </button>
          </div>
        </div>

        {compareData && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4">
            <h2 className="text-xl font-bold">对比结果</h2>
            <p className="text-red-100 text-sm mt-1">{compareData.recommendation}</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-4 text-left font-bold text-gray-700 w-40">对比项</th>
                    {compareData.activities?.map((act: Activity) => (
                      <th key={act.id} className="px-6 py-4 text-center font-bold text-gray-700 min-w-64">
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative w-20 h-16 rounded overflow-hidden">
                            <Image
                              src={act.coverImage || `https://picsum.photos/200/100?random=${act.id}`}
                              alt={act.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span className="text-red-700">{act.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareData.compareFields?.map((field: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 font-medium text-gray-700 border-t">{field.label}</td>
                      {compareData.activities?.map((act: any) => (
                        <td key={act.id} className="px-6 py-4 text-center border-t text-gray-600">
                          {formatValue(act[field.field], field.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 border-t bg-gray-50">
              <h3 className="font-bold text-gray-700 mb-4">立即报名</h3>
              <div className="flex gap-4 flex-wrap">
                {compareData.activities?.map((act: Activity) => (
                  <Link
                    key={act.id}
                    href={`/activities/${act.id}`}
                    className="flex-1 min-w-48 px-6 py-3 bg-red-600 text-white text-center rounded-lg font-bold hover:bg-red-700 transition"
                  >
                    报名「{act.name}」
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
