const jwt = require('jsonwebtoken')
const { User } = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'rubbing-digitization-secret-2024'

const authMiddleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    ctx.status = 401
    ctx.body = { error: '未提供认证令牌' }
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findByPk(decoded.userId)

    if (!user || user.status !== 'active') {
      ctx.status = 401
      ctx.body = { error: '用户不存在或已被禁用' }
      return
    }

    ctx.state.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      realName: user.realName
    }

    await next()
  } catch (err) {
    ctx.status = 401
    ctx.body = { error: '无效的认证令牌' }
  }
}

authMiddleware.unless = require('koa-unless')

module.exports = authMiddleware
module.exports.JWT_SECRET = JWT_SECRET
