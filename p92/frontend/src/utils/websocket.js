import { ElMessage } from 'element-plus'

class WebSocketService {
  constructor() {
    this.socket = null
    this.stompClient = null
    this.connected = false
    this.subscriptions = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve()
        return
      }

      try {
        const socketUrl = 'http://localhost:8080/ws'
        this.socket = new SockJS(socketUrl)
        this.stompClient = Stomp.over(this.socket)
        
        this.stompClient.connect(
          {},
          (frame) => {
            console.log('WebSocket连接成功:', frame)
            this.connected = true
            this.reconnectAttempts = 0
            resolve()
          },
          (error) => {
            console.error('WebSocket连接失败:', error)
            this.connected = false
            this.handleReconnect()
            reject(error)
          }
        )
      } catch (error) {
        console.error('WebSocket初始化失败:', error)
        reject(error)
      }
    })
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`尝试重连 WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => {
        this.connect().catch(() => {
          this.handleReconnect()
        })
      }, this.reconnectDelay)
    } else {
      console.error('WebSocket重连次数已达上限，停止重连')
    }
  }

  subscribe(topic, callback) {
    if (!this.connected) {
      console.warn('WebSocket未连接，无法订阅主题:', topic)
      return
    }

    if (this.subscriptions.has(topic)) {
      console.warn('已订阅该主题:', topic)
      return
    }

    const subscription = this.stompClient.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message.body)
        callback(data)
      } catch (error) {
        console.error('解析WebSocket消息失败:', error)
      }
    })

    this.subscriptions.set(topic, subscription)
    console.log('已订阅主题:', topic)
  }

  unsubscribe(topic) {
    const subscription = this.subscriptions.get(topic)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(topic)
      console.log('已取消订阅主题:', topic)
    }
  }

  send(destination, data) {
    if (!this.connected) {
      console.warn('WebSocket未连接，无法发送消息')
      return
    }
    this.stompClient.send(destination, {}, JSON.stringify(data))
  }

  disconnect() {
    this.subscriptions.forEach((subscription, topic) => {
      subscription.unsubscribe()
    })
    this.subscriptions.clear()

    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.disconnect(() => {
        console.log('WebSocket连接已断开')
        this.connected = false
      })
    }
  }
}

export default new WebSocketService()
