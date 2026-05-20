const Router = require('koa-router')
const { Annotation, Rubbing, OperationLog, User } = require('../models')
const logger = require('../utils/logger')

const router = new Router({ prefix: '/api/annotation' })

router.get('/rubbing/:rubbingId', async (ctx) => {
  const { rubbingId } = ctx.params
  const { page = 1, pageSize = 100, status } = ctx.query

  const where = { rubbingId }
  if (status) where.status = status

  const { count, rows } = await Annotation.findAndCountAll({
    where,
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize),
    order: [['position', 'ASC']],
    include: [{ model: User, as: 'User', attributes: ['id', 'username', 'realName'] }]
  })

  ctx.body = {
    annotations: rows,
    total: count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
})

router.post('/', async (ctx) => {
  try {
    const {
      rubbingId,
      character,
      pinyin,
      radical,
      strokeCount,
      variant,
      meaning,
      notes,
      boundingBox,
      position
    } = ctx.request.body

    if (!rubbingId) {
      ctx.status = 400
      ctx.body = { error: '缺少必要参数' }
      return
    }

    if (ctx.state.user.role === 'viewer') {
      ctx.status = 403
      ctx.body = { error: '查看者权限无法添加释读' }
      return
    }

    const rubbing = await Rubbing.findByPk(rubbingId)
    if (!rubbing) {
      ctx.status = 404
      ctx.body = { error: '拓片不存在' }
      return
    }

    const annotation = await Annotation.create({
      rubbingId,
      annotatorId: ctx.state.user.id,
      character: character || '',
      pinyin: pinyin || '',
      radical: radical || '',
      strokeCount: strokeCount || 1,
      variant: variant || '',
      meaning: meaning || '',
      notes: notes || '',
      boundingBox: boundingBox || {},
      position: position !== undefined ? position : 0,
      status: 'draft'
    })

    const annotatedCount = await Annotation.count({
      where: { rubbingId, status: ['submitted', 'reviewed', 'finalized'] }
    })

    const progress = Math.round((annotatedCount / Math.max(rubbing.totalCharacters || 1, 1)) * 100)

    await rubbing.update({
      annotatedCharacters: annotatedCount,
      annotationProgress: progress,
      status: progress >= 100 ? 'completed' : rubbing.status
    })

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'create_annotation',
      module: 'annotation',
      description: `为拓片 ${rubbing.title} 添加释读: ${character || '(空)'}`
    })

    ctx.body = {
      message: '释读添加成功',
      annotation
    }
  } catch (err) {
    logger.error('创建释读失败:', err)
    ctx.status = 500
    ctx.body = { error: '创建失败: ' + err.message }
  }
})

router.get('/:id', async (ctx) => {
  const { id } = ctx.params

  const annotation = await Annotation.findByPk(id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'username', 'realName'] },
      { model: Rubbing, attributes: ['id', 'title'] }
    ]
  })

  if (!annotation) {
    ctx.status = 404
    ctx.body = { error: '释读不存在' }
    return
  }

  ctx.body = annotation
})

router.put('/:id', async (ctx) => {
  const { id } = ctx.params
  const updateData = ctx.request.body

  const annotation = await Annotation.findByPk(id)
  if (!annotation) {
    ctx.status = 404
    ctx.body = { error: '释读不存在' }
    return
  }

  if (ctx.state.user.role === 'viewer') {
    ctx.status = 403
    ctx.body = { error: '权限不足，无法编辑' }
    return
  }

  await annotation.update(updateData)

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'update_annotation',
    module: 'annotation',
    description: `更新释读: ${annotation.character}`
  })

  ctx.body = { message: '更新成功', annotation }
})

router.delete('/:id', async (ctx) => {
  const { id } = ctx.params

  const annotation = await Annotation.findByPk(id)
  if (!annotation) {
    ctx.status = 404
    ctx.body = { error: '释读不存在' }
    return
  }

  if (ctx.state.user.role === 'viewer') {
    ctx.status = 403
    ctx.body = { error: '权限不足，无法删除' }
    return
  }

  const rubbing = await Rubbing.findByPk(annotation.rubbingId)
  await annotation.destroy()

  if (rubbing) {
    const annotatedCount = await Annotation.count({
      where: { rubbingId: annotation.rubbingId, status: ['submitted', 'reviewed', 'finalized'] }
    })

    const progress = Math.round((annotatedCount / Math.max(rubbing.totalCharacters || 1, 1)) * 100)

    await rubbing.update({
      annotatedCharacters: annotatedCount,
      annotationProgress: progress
    })
  }

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'delete_annotation',
    module: 'annotation',
    description: `删除释读: ${annotation.character}`
  })

  ctx.body = { message: '删除成功' }
})

router.post('/:id/submit', async (ctx) => {
  const { id } = ctx.params

  const annotation = await Annotation.findByPk(id)
  if (!annotation) {
    ctx.status = 404
    ctx.body = { error: '释读不存在' }
    return
  }

  if (ctx.state.user.role !== 'admin' && annotation.annotatorId !== ctx.state.user.id) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  await annotation.update({ status: 'submitted' })

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'submit_annotation',
    module: 'annotation',
    description: `提交释读审核: ${annotation.character}`
  })

  ctx.body = { message: '提交成功' }
})

router.post('/:id/review', async (ctx) => {
  const { id } = ctx.params
  const { status, reviewNotes } = ctx.request.body

  if (!['admin', 'expert'].includes(ctx.state.user.role)) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const annotation = await Annotation.findByPk(id)
  if (!annotation) {
    ctx.status = 404
    ctx.body = { error: '释读不存在' }
    return
  }

  await annotation.update({
    status,
    notes: annotation.notes ? `${annotation.notes}\n审核意见: ${reviewNotes}` : `审核意见: ${reviewNotes}`
  })

  await OperationLog.create({
    userId: ctx.state.user.id,
    action: 'review_annotation',
    module: 'annotation',
    description: `审核释读: ${annotation.character}, 结果: ${status}`
  })

  ctx.body = { message: '审核完成' }
})

router.get('/:rubbingId/export', async (ctx) => {
  const { rubbingId } = ctx.params
  const { format = 'json', status } = ctx.query

  const rubbing = await Rubbing.findByPk(rubbingId)
  if (!rubbing) {
    ctx.status = 404
    ctx.body = { error: '拓片不存在' }
    return
  }

  try {
    const where = { rubbingId }
    if (status) where.status = status

    const annotations = await Annotation.findAll({
      where,
      order: [['position', 'ASC']],
      include: [{ model: User, as: 'User', attributes: ['id', 'username', 'realName'] }]
    })

    if (format === 'json') {
      ctx.body = {
        rubbing: {
          id: rubbing.id,
          title: rubbing.title,
          dynasty: rubbing.dynasty,
          category: rubbing.category,
          totalCharacters: rubbing.totalCharacters,
          annotationProgress: rubbing.annotationProgress
        },
        annotations: annotations.map(a => ({
          id: a.id,
          character: a.character,
          pinyin: a.pinyin,
          radical: a.radical,
          strokeCount: a.strokeCount,
          meaning: a.meaning,
          notes: a.notes,
          status: a.status,
          position: a.position,
          annotator: a.User ? a.User.realName || a.User.username : null,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt
        })),
        exportTime: new Date().toISOString(),
        totalCount: annotations.length
      }
    } else if (format === 'csv') {
      const header = '序号,文字,拼音,部首,笔画,释义,备注,状态,标注人,创建时间\n'
      const rows = annotations.map((a, index) => {
        const annotatorName = a.User ? (a.User.realName || a.User.username) : ''
        return [
          index + 1,
          a.character,
          a.pinyin,
          a.radical,
          a.strokeCount,
          `"${(a.meaning || '').replace(/"/g, '""')}"`,
          `"${(a.notes || '').replace(/"/g, '""')}"`,
          a.status,
          annotatorName,
          a.createdAt
        ].join(',')
      }).join('\n')

      ctx.set('Content-Type', 'text/csv; charset=utf-8')
      ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(rubbing.title)}-释读结果.csv"`)
      ctx.body = '\uFEFF' + header + rows
    } else {
      ctx.status = 400
      ctx.body = { error: '不支持的导出格式' }
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'export_annotations',
      module: 'annotation',
      description: `导出拓片释读结果: ${rubbing.title}, 格式: ${format}`
    })
  } catch (err) {
    logger.error('导出失败:', err)
    ctx.status = 500
    ctx.body = { error: '导出失败: ' + err.message }
  }
})

module.exports = router
