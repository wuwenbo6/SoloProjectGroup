const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../middleware/auth')
const { User, CollaborationSession } = require('../models')

const activeUsers = new Map()

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token?.replace('Bearer ', '')
      if (!token) {
        return next(new Error('未提供认证令牌'))
      }

      const decoded = jwt.verify(token, JWT_SECRET)
      const user = await User.findByPk(decoded.userId)

      if (!user || user.status !== 'active') {
        return next(new Error('用户不存在或已被禁用'))
      }

      socket.user = {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role
      }

      next()
    } catch (err) {
      next(new Error('无效的认证令牌'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.user.username}`)

    socket.on('join-rubbing', async ({ rubbingId }) => {
      socket.join(`rubbing:${rubbingId}`)

      if (!activeUsers.has(rubbingId)) {
        activeUsers.set(rubbingId, new Set())
      }
      activeUsers.get(rubbingId).add(socket.user.id)

      let session = await CollaborationSession.findOne({
        where: { rubbingId, status: 'active' }
      })

      if (!session) {
        session = await CollaborationSession.create({
          rubbingId,
          sessionName: `协同释读-${Date.now()}`
        })
      }

      io.to(`rubbing:${rubbingId}`).emit('user-joined', {
        user: socket.user,
        activeUsers: Array.from(activeUsers.get(rubbingId)),
        timestamp: new Date()
      })

      console.log(`用户 ${socket.user.username} 加入拓片 ${rubbingId} 协同`)
    })

    socket.on('leave-rubbing', async ({ rubbingId }) => {
      socket.leave(`rubbing:${rubbingId}`)

      if (activeUsers.has(rubbingId)) {
        activeUsers.get(rubbingId).delete(socket.user.id)

        io.to(`rubbing:${rubbingId}`).emit('user-left', {
          userId: socket.user.id,
          username: socket.user.username,
          activeUsers: Array.from(activeUsers.get(rubbingId)),
          timestamp: new Date()
        })
      }

      console.log(`用户 ${socket.user.username} 离开拓片 ${rubbingId} 协同`)
    })

    socket.on('annotation-update', async ({ rubbingId, annotation }) => {
      socket.to(`rubbing:${rubbingId}`).emit('annotation-changed', {
        annotation,
        user: socket.user,
        timestamp: new Date()
      })
    })

    socket.on('cursor-position', async ({ rubbingId, position }) => {
      socket.to(`rubbing:${rubbingId}`).emit('cursor-update', {
        userId: socket.user.id,
        username: socket.user.username,
        position,
        timestamp: new Date()
      })
    })

    socket.on('chat-message', async ({ rubbingId, message }) => {
      io.to(`rubbing:${rubbingId}`).emit('new-message', {
        user: socket.user,
        message,
        timestamp: new Date()
      })
    })

    socket.on('disconnect', () => {
      console.log(`用户断开连接: ${socket.user.username}`)

      activeUsers.forEach((users, rubbingId) => {
        if (users.has(socket.user.id)) {
          users.delete(socket.user.id)
          io.to(`rubbing:${rubbingId}`).emit('user-left', {
            userId: socket.user.id,
            username: socket.user.username,
            activeUsers: Array.from(users),
            timestamp: new Date()
          })
        }
      })
    })
  })
}
