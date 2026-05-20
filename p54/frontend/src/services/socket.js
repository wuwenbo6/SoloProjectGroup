import { io } from 'socket.io-client'

class SocketService {
  socket = null

  connect() {
    if (this.socket) return

    const token = localStorage.getItem('token')
    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket']
    })

    this.socket.on('connect', () => {
      console.log('Socket connected')
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinSession(rubbingId) {
    this.socket?.emit('join-session', { rubbingId })
  }

  leaveSession(rubbingId) {
    this.socket?.emit('leave-session', { rubbingId })
  }

  on(event, callback) {
    this.socket?.on(event, callback)
  }

  off(event, callback) {
    this.socket?.off(event, callback)
  }

  emit(event, data) {
    this.socket?.emit(event, data)
  }
}

export default new SocketService()
