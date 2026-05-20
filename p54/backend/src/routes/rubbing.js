const Router = require('koa-router')
const fs = require('fs').promises
const path = require('path')
const { Rubbing, OperationLog, User, Annotation, sequelize } = require('../models')
const { storageService, STORAGE_TIERS } = require('../services/StorageService')
const logger = require('../utils/logger')

const router = new Router({ prefix: '/api/rubbing' })

router.post('/upload', async (ctx) => {
  try {
    const { title, description, category, dynasty, author, era, location, sourceType, tier = 'hot' } = ctx.request.body
    const file = ctx.request.files?.file

    if (!file) {
      ctx.status = 400
      ctx.body = { error: '请选择上传文件' }
      return
    }

    if (!title) {
      ctx.status = 400
      ctx.body = { error: '请输入标题' }
      return
    }

    const fileData = await fs.readFile(file.filepath)
    const fileName = file.originalFilename

    const storageResult = await storageService.storeImage(
      fileData,
      fileName,
      {
        tier: tier in STORAGE_TIERS ? tier : STORAGE_TIERS.HOT,
        rubbingId: 'temp'
      }
    )

    const rubbing = await Rubbing.create({
      title,
      description,
      category: category || 'stele',
      dynasty,
      author,
      era,
      location,
      sourceType: sourceType || 'import',
      originalImage: storageResult.versions.original?.path || storageResult.versions.preview?.path,
      processedImage: storageResult.versions.preview?.path,
      thumbnail: storageResult.versions.thumbnail?.path,
      uploaderId: ctx.state.user.id,
      storageTier: storageResult.tier
    })

    await storageService.migrateToTier(
      storageResult.versions.preview?.path || storageResult.versions.original?.path,
      fileName,
      STORAGE_TIERS.HOT,
      storageResult.tier,
      rubbing.id
    )

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'upload_rubbing',
      module: 'rubbing',
      description: `上传拓片: ${title}, 存储层级: ${storageResult.tier}`
    })

    ctx.body = {
      message: '上传成功',
      rubbing,
      storage: storageResult
    }
  } catch (err) {
    logger.error('上传拓片失败:', err)
    ctx.status = 500
    ctx.body = { error: '上传失败: ' + err.message }
  }
})

router.post('/:id/process', async (ctx) => {
  const { id } = ctx.params
  const { denoiseLevel = 50, contrastLevel = 30 } = ctx.request.body

  const rubbing = await Rubbing.findByPk(id)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  try {
    await rubbing.update({ status: 'processing' })

    const imageUrl = rubbing.processedImage || rubbing.originalImage
    const originalPath = path.join(__dirname, '../../uploads', imageUrl)
    const fileData = await fs.readFile(originalPath)

    const storageResult = await storageService.storeImage(
      fileData,
      path.basename(imageUrl),
      {
        tier: STORAGE_TIERS.HOT,
        rubbingId: id.toString()
      }
    )

    await rubbing.update({
      processedImage: storageResult.versions.preview?.path,
      thumbnail: storageResult.versions.thumbnail?.path,
      status: 'processed',
      storageTier: STORAGE_TIERS.HOT
    })

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'process_rubbing',
      module: 'rubbing',
      description: `处理拓片: ${rubbing.title}`
    })

    ctx.body = {
      message: '处理成功',
      processedImage: storageResult.versions.preview?.path
    }
  } catch (err) {
    logger.error('处理拓片失败:', err)
    await rubbing.update({ status: 'uploaded' })
    ctx.status = 500
    ctx.body = { error: '处理失败: ' + err.message }
  }
})

router.get('/list', async (ctx) => {
  const { page = 1, pageSize = 20, category, status, dynasty, keyword } = ctx.query
  const where = {}

  if (category) where.category = category
  if (status) where.status = status
  if (dynasty) where.dynasty = dynasty
  if (keyword) {
    where[sequelize.Op.or] = [
      { title: { [sequelize.Op.like]: `%${keyword}%` } },
      { description: { [sequelize.Op.like]: `%${keyword}%` } }
    ]
  }

  const { count, rows } = await Rubbing.findAndCountAll({
    where,
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize),
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'User', attributes: ['id', 'username', 'realName'] }],
    attributes: { exclude: ['metadata'] }
  })

  ctx.body = {
    rubbings: rows,
    total: count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
})

router.get('/:id', async (ctx) => {
  const { id } = ctx.params

  const rubbing = await Rubbing.findByPk(id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'username', 'realName'] },
      { model: Annotation, limit: 200, order: [['position', 'ASC']] }
    ]
  })

  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  const versions = await storageService.getVersions(id.toString(), path.basename(rubbing.originalImage || ''))

  ctx.body = {
    ...rubbing.toJSON(),
    storageVersions: versions
  }
})

router.put('/:id', async (ctx) => {
  const { id } = ctx.params
  const updateData = ctx.request.body

  const rubbing = await Rubbing.findByPk(id)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  if (ctx.state.user.role !== 'admin' && rubbing.uploaderId !== ctx.state.user.id) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  await rubbing.update(updateData)

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'update_rubbing',
    module: 'rubbing',
    description: `更新拓片: ${rubbing.title}`
  })

  ctx.body = { message: '更新成功', rubbing }
})

router.delete('/:id', async (ctx) => {
  const { id } = ctx.params

  const rubbing = await Rubbing.findByPk(id)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  await storageService.deleteImage(id.toString(), path.basename(rubbing.originalImage || ''))
  await rubbing.destroy()

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'delete_rubbing',
    module: 'rubbing',
    description: `删除拓片: ${rubbing.title}`
  })

  ctx.body = { message: '删除成功' }
})

router.post('/:id/repair', async (ctx) => {
  const { id } = ctx.params
  const { repairMode = 'auto', denoiseLevel = 50, contrastLevel = 30 } = ctx.request.body

  const rubbing = await Rubbing.findByPk(id)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  try {
    await rubbing.update({ status: 'processing' })

    const originalPath = rubbing.processedImage || rubbing.originalImage
    const fullPath = path.join(__dirname, '../../uploads', originalPath)
    const fileData = await fs.readFile(fullPath)

    const storageResult = await storageService.storeImage(
      fileData,
      `repaired-${path.basename(originalPath)}`,
      {
        tier: STORAGE_TIERS.HOT,
        rubbingId: id.toString()
      }
    )

    await rubbing.update({
      processedImage: storageResult.versions.preview?.path,
      thumbnail: storageResult.versions.thumbnail?.path,
      status: 'processed'
    })

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'repair_rubbing',
      module: 'rubbing',
      description: `修复拓片图像: ${rubbing.title}, 模式: ${repairMode}`
    })

    ctx.body = {
      message: '图像修复成功',
      repairedImage: storageResult.versions.preview?.path
    }
  } catch (err) {
    logger.error('修复拓片失败:', err)
    await rubbing.update({ status: 'uploaded' })
    ctx.status = 500
    ctx.body = { error: '图像修复失败: ' + err.message }
  }
})

router.post('/:id/migrate', async (ctx) => {
  const { id } = ctx.params
  const { targetTier } = ctx.request.body

  if (!Object.values(STORAGE_TIERS).includes(targetTier)) {
    ctx.status = 400
    ctx.body = { error: '无效的存储层级' }
    return
  }

  const rubbing = await Rubbing.findByPk(id)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  try {
    const versions = await storageService.getVersions(id.toString(), path.basename(rubbing.originalImage || ''))

    if (versions.preview) {
      await storageService.migrateToTier(
        versions.preview.path,
        path.basename(rubbing.originalImage || ''),
        versions.preview.tier,
        targetTier
      )
    }

    await rubbing.update({ storageTier: targetTier })

    ctx.body = { message: '迁移成功' }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '迁移失败: ' + err.message }
  }
})

router.get('/admin/storage-stats', async (ctx) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  try {
    const stats = await storageService.getStorageStats()
    ctx.body = stats
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '获取存储统计失败' }
  }
})

module.exports = router
