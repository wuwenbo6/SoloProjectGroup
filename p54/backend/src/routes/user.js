const Router = require('koa-router')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../middleware/auth')
const { User, OperationLog, sequelize } = require('../models')

const router = new Router({ prefix: '/api/user' })

router.post('/register', async (ctx) => {
  const { username, email, password, realName, role } = ctx.request.body

  if (!username || !email || !password) {
    ctx.status = 400
    ctx.body = { error: '请填写必要信息' }
    return
  }

  const existingUser = await User.findOne({
    where: {
      [sequelize.Op.or]: [{ username }, { email }]
    }
  })

  if (existingUser) {
    ctx.status = 400
    ctx.body = { error: '用户名或邮箱已存在' }
    return
  }

  const user = await User.create({
    username,
    email,
    password,
    realName,
    role: role || 'viewer'
  })

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

  ctx.body = {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      realName: user.realName
    }
  }
})

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body

  const user = await User.findOne({ where: { username } })

  if (!user || !(await user.validPassword(password))) {
    ctx.status = 401
    ctx.body = { error: '用户名或密码错误' }
    return
  }

  if (user.status !== 'active') {
    ctx.status = 403
    ctx.body = { error: '账户已被禁用' }
    return
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

  await OperationLog.create({
    userId: user.id,
    action: 'login',
    module: 'user',
    ipAddress: ctx.ip
  })

  ctx.body = {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      realName: user.realName
    }
  }
})

router.get('/profile', async (ctx) => {
  const user = await User.findByPk(ctx.state.user.id, {
    attributes: { exclude: ['password'] }
  })
  ctx.body = user
})

router.get('/list', async (ctx) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { page = 1, pageSize = 20, role, status } = ctx.query
  const where = {}
  if (role) where.role = role
  if (status) where.status = status

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize),
    order: [['createdAt', 'DESC']]
  })

  ctx.body = {
    users: rows,
    total: count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
})

router.put('/:id', async (ctx) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { id } = ctx.params
  const updateData = ctx.request.body
  delete updateData.password

  const user = await User.findByPk(id)
  if (!user) {
    ctx.status = 404
    ctx.body = { error: '用户不存在' }
    return
  }

  await user.update(updateData)

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'update_user',
    module: 'user',
    description: `更新用户 ${user.username} 的信息`
  })

  ctx.body = { message: '更新成功' }
})

router.delete('/:id', async (ctx) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { id } = ctx.params
  const user = await User.findByPk(id)

  if (!user) {
    ctx.status = 404
    ctx.body = { error: '用户不存在' }
    return
  }

  await user.update({ status: 'suspended' })

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'delete_user',
    module: 'user',
    description: `禁用用户 ${user.username}`
  })

  ctx.body = { message: '用户已禁用' }
})

module.exports = router
