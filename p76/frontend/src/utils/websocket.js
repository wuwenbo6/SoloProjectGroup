import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

class WebSocketService {
  constructor() {
    this.client = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
    this.subscriptions = new Map()
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const socket = new SockJS('/ws')
        this.client = new Client({
          webSocketFactory: () => socket,
          reconnectDelay: this.reconnectDelay,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        })

        this.client.onConnect = (frame) => {
          console.log('WebSocket连接成功:', frame)
          this.connected = true
          this.reconnectAttempts = 0
          resolve(frame)
        }

        this.client.onDisconnect = (frame) => {
          console.log('WebSocket断开连接:', frame)
          this.connected = false
        }

        this.client.onStompError = (frame) => {
          console.error('WebSocket错误:', frame)
          reject(frame)
        }

        this.client.onWebSocketError = (error) => {
          console.error('WebSocket连接错误:', error)
          this.attemptReconnect()
        }

        this.client.activate()
      } catch (error) {
        console.error('WebSocket连接异常:', error)
        reject(error)
      }
    })
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => this.connect(), this.reconnectDelay)
    } else {
      console.error('达到最大重连次数，停止重连')
    }
  }

  subscribe(destination, callback) {
    if (!this.connected || !this.client) {
      console.warn('WebSocket未连接，订阅失败')
      return null
    }

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body)
        callback(data)
      } catch (error) {
        console.error('消息解析失败:', error)
        callback(message.body)
      }
    })

    this.subscriptions.set(destination, subscription)
    return subscription
  }

  unsubscribe(destination) {
    const subscription = this.subscriptions.get(destination)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(destination)
    }
  }

  publish(destination, data) {
    if (!this.connected || !this.client) {
      console.warn('WebSocket未连接，发送失败')
      return
    }

    this.client.publish({
      destination,
      body: JSON.stringify(data)
    })
  }

  disconnect() {
    if (this.client) {
      this.subscriptions.forEach((sub) => sub.unsubscribe())
      this.subscriptions.clear()
      this.client.deactivate()
      this.connected = false
    }
  }
}

export default new WebSocketService()
