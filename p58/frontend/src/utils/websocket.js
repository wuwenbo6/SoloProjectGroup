import { Client } from '@stomp/stompjs'
import { ElMessage } from 'element-plus'

class WebSocketService {
  constructor() {
    this.stompClient = null
    this.connected = false
    this.subscriptions = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 3000
  }

  connect() {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token')
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

      this.stompClient = new Client({
        brokerURL: `${wsUrl}/ws`,
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        reconnectDelay: this.reconnectDelay,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          this.connected = true
          this.reconnectAttempts = 0
          console.log('WebSocket连接成功')
          resolve()
        },
        onDisconnect: () => {
          this.connected = false
          console.log('WebSocket连接断开')
        },
        onStompError: (frame) => {
          console.error('WebSocket错误:', frame)
          this.reconnectAttempts++
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            ElMessage.error('WebSocket连接失败，请刷新页面重试')
            reject(frame)
          }
        },
        onWebSocketError: (error) => {
          console.error('WebSocket底层错误:', error)
        }
      })

      this.stompClient.activate()
    })
  }

  subscribe(topic, callback) {
    if (!this.stompClient || !this.connected) {
      console.warn('WebSocket未连接，订阅失败')
      return
    }

    if (this.subscriptions.has(topic)) {
      console.log('已订阅该主题:', topic)
      return
    }

    const subscription = this.stompClient.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message.body)
        callback(data)
      } catch (error) {
        console.error('消息解析失败:', error)
      }
    })

    this.subscriptions.set(topic, subscription)
    console.log('订阅成功:', topic)
  }

  unsubscribe(topic) {
    const subscription = this.subscriptions.get(topic)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(topic)
      console.log('取消订阅:', topic)
    }
  }

  subscribeProcessProgress(callback) {
    this.subscribe('/topic/process-progress', callback)
  }

  subscribeProcessAbnormal(callback) {
    this.subscribe('/topic/process-abnormal', callback)
  }

  subscribeProcessComplete(callback) {
    this.subscribe('/topic/process-complete', callback)
  }

  disconnect() {
    if (this.stompClient) {
      this.subscriptions.forEach((subscription) => {
        subscription.unsubscribe()
      })
      this.subscriptions.clear()
      this.stompClient.deactivate()
      this.connected = false
      console.log('WebSocket已断开')
    }
  }
}

export default new WebSocketService()
