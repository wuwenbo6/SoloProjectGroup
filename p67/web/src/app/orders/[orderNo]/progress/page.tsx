'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ProgressItem {
  index: number
  text: string
  completed: boolean
  time?: string
}

export default function OrderProgressPage() {
  const params = useParams()
  const orderNo = params.orderNo as string

  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetchProgress()
    startWebSocket()
  }, [orderNo])

  const fetchProgress = async () => {
    try {
      const res = await fetch(`/api/order/progress/${orderNo}`)
      const data = await res.json()
      if (data.code === 200) {
        setProgress(data.data || [])
      }
    } catch (e) {
      console.error('获取进度失败', e)
    } finally {
      setLoading(false)
    }
  }

  const startWebSocket = () => {
    const ws = new WebSocket(`ws://localhost:9000/ws/order-sync?orderNo=${orderNo}`)
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'ORDER_PROGRESS') {
          setNotifications(prev => [message, ...prev].slice(0, 5))
          fetchProgress()
          
          if (Notification.permission === 'granted') {
            new Notification(message.title, { body: message.content })
          }
        }
      } catch (e) {
        console.error('解析WebSocket消息失败', e)
      }
    }

    ws.onopen = () => {
      console.log('WebSocket连接成功')
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }

    return () => ws.close()
  }

  const handleSimulate = async () => {
    setSimulating(true)
    try {
      await fetch(`/api/order/progress/simulate/${orderNo}`, { method: 'POST' })
    } catch (e) {
      console.error('模拟进度失败', e)
    } finally {
      setTimeout(() => setSimulating(false), 12000)
    }
  }

  const getStatusColor = (completed: boolean, isCurrent: boolean) => {
    if (completed) return 'bg-green-500'
    if (isCurrent) return 'bg-yellow-500 animate-pulse'
    return 'bg-gray-300'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-red-700 to-red-800 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href="/admin" className="flex items-center gap-2">
            <span>←</span> 返回订单管理
          </Link>
          <h1 className="text-xl font-bold">订单进度追踪</h1>
          <div className="w-20"></div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {notifications.length > 0 && (
          <div className="mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-bold text-yellow-800 mb-2">📢 最新通知</h3>
              {notifications.slice(0, 1).map((n, i) => (
                <div key={i} className="bg-white rounded p-3">
                  <div className="font-medium text-gray-800">{n.title}</div>
                  <div className="text-gray-600 text-sm">{n.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-red-800">订单号: {orderNo}</h2>
              <p className="text-gray-500 mt-1">实时追踪订单进度</p>
            </div>
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition disabled:bg-gray-400"
            >
              {simulating ? '模拟中...' : '模拟进度更新'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">加载中...</div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-6 bottom-6 w-1 bg-gray-200">
                <div 
                  className="bg-green-500 transition-all duration-500"
                  style={{ 
                    height: `${(progress.filter(p => p.completed).length / progress.length) * 100}%` 
                  }}
                />
              </div>

              <div className="space-y-8">
                {progress.map((item, idx) => {
                  const isCurrent = item.completed && (idx === progress.length - 1 || !progress[idx + 1]?.completed)
                  return (
                    <div key={idx} className="flex items-start gap-6 relative z-10">
                      <div className={`w-12 h-12 rounded-full ${getStatusColor(item.completed, isCurrent)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                        {item.completed ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1 pt-2">
                        <div className={`font-bold text-lg ${item.completed ? 'text-green-600' : 'text-gray-400'}`}>
                          {item.text}
                        </div>
                        {item.time && (
                          <div className="text-gray-500 text-sm mt-1">
                            {new Date(item.time).toLocaleString('zh-CN')}
                          </div>
                        )}
                        {isCurrent && (
                          <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                            当前状态
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-800 mb-4">💡 进度说明</h3>
          <ul className="space-y-2 text-blue-700">
            <li>• <strong>已下单</strong> - 订单提交成功，等待系统确认</li>
            <li>• <strong>已确认</strong> - 活动主办方确认名额有效</li>
            <li>• <strong>已支付</strong> - 支付成功，报名费用已到账</li>
            <li>• <strong>报名成功</strong> - 报名流程完成，等待活动开始</li>
            <li>• <strong>活动进行中</strong> - 活动正在进行，祝您体验愉快</li>
            <li>• <strong>已完成</strong> - 活动圆满结束，感谢您的参与</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
