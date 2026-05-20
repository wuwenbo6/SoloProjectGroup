class WebSocketClient {
  constructor(url) {
    this.url = url
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
    this.heartbeatInterval = null
    this.heartbeatTimeout = null
    this.listeners = {}
    this.messageQueue = []
    this.isProcessing = false
    this.lastMessageTime = 0
    this.throttleDelay = 50
    this.pendingMessages = []
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)
      
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.startHeartbeat()
        this.flushPendingMessages()
        this.emit('connected')
      }

      this.ws.onmessage = (event) => {
        const now = Date.now()
        if (now - this.lastMessageTime < this.throttleDelay) {
          this.messageQueue.push(event.data)
          this.processQueue()
          return
        }
        this.lastMessageTime = now
        this.processMessage(event.data)
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.stopHeartbeat()
        this.emit('error', error)
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code)
        this.stopHeartbeat()
        this.emit('disconnected')
        if (!event.wasClean) {
          this.reconnect()
        }
      }
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.reconnect()
    }
  }

  processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return
    }

    this.isProcessing = true
    const batchSize = Math.min(this.messageQueue.length, 5)
    const batch = this.messageQueue.splice(0, batchSize)

    batch.forEach((data) => {
      this.processMessage(data, true)
    })

    setTimeout(() => {
      this.isProcessing = false
      if (this.messageQueue.length > 0) {
        this.processQueue()
      }
    }, 10)
  }

  processMessage(data, isBatch = false) {
    try {
      const parsedData = JSON.parse(data)
      if (!isBatch) {
        requestAnimationFrame(() => {
          this.emit('message', parsedData)
        })
      } else {
        this.emit('message', parsedData)
      }
    } catch (e) {
      console.error('Parse message error:', e)
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000)
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}, delay: ${delay}ms`)
      setTimeout(() => this.connect(), delay)
    } else {
      console.error('Max reconnect attempts reached')
      this.emit('maxReconnectFailed')
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.pendingMessages.push(data)
    }
  }

  flushPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const data = this.pendingMessages.shift()
      this.send(data)
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (e) {
          console.error('Listener error:', e)
        }
      })
    }
  }

  disconnect() {
    this.stopHeartbeat()
    this.messageQueue = []
    this.pendingMessages = []
    if (this.ws) {
      this.ws.close()
    }
  }

  setThrottleDelay(delay) {
    this.throttleDelay = delay
  }
}

const wsClient = new WebSocketClient('ws://localhost:8080/ws/detection')

export default wsClient
