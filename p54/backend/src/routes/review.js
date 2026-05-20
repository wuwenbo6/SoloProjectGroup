const Router = require('koa-router')
const { Op } = require('sequelize')
const Review = require('../models/Review')
const Annotation = require('../models/Annotation')
const Rubbing = require('../models/Rubbing')
const User = require('../models/User')
const OperationLog = require('../models/OperationLog')
const logger = require('../utils/logger')

const router = new Router({ prefix: '/api/review' })

router.post('/batch-submit', async (ctx) => {
  if (!['admin', 'expert', 'annotator'].includes(ctx.state.user.role)) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { annotationIds, priority = 'normal' } = ctx.request.body

  if (!Array.isArray(annotationIds) || annotationIds.length === 0) {
    ctx.status = 400
    ctx.body = { error: '请选择要提交审核的释读' }
    return
  }

  try {
    const annotations = await Annotation.findAll({
      where: {
        id: { [Op.in]: annotationIds },
        annotatorId: ctx.state.user.id
      }
    })

    const results = []
    for (const annotation of annotations) {
      const existingReview = await Review.findOne({
        where: {
          annotationId: annotation.id,
          status: { [Op.in]: ['pending', 'approved'] }
        }
      })

      if (!existingReview) {
        const review = await Review.create({
          annotationId: annotation.id,
          rubbingId: annotation.rubbingId,
          reviewerId: ctx.state.user.id,
          status: 'pending',
          priority,
          originalData: {
            character: annotation.character,
            pinyin: annotation.pinyin,
            radical: annotation.radical,
            meaning: annotation.meaning,
            strokeCount: annotation.strokeCount
          }
        })
        results.push(review)
        await annotation.update({ status: 'submitted' })
      }
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'batch_submit_review',
      module: 'review',
      description: `批量提交${results.length}条释读进入审核`
    })

    ctx.body = {
      message: '提交成功',
      submittedCount: results.length
    }
  } catch (err) {
    logger.error('批量提交审核失败:', err)
    ctx.status = 500
    ctx.body = { error: '提交失败: ' + err.message }
  }
})

router.get('/list', async (ctx) => {
  const {
    page = 1,
    pageSize = 20,
    status,
    priority,
    rubbingId,
    reviewerId,
    myReviews
  } = ctx.query

  try {
    const where = {}

    if (status) where.status = status
    if (priority) where.priority = priority
    if (rubbingId) where.rubbingId = rubbingId
    if (reviewerId) where.reviewerId = reviewerId

    if (myReviews === 'true') {
      where.reviewerId = ctx.state.user.id
    } else if (['expert', 'admin'].includes(ctx.state.user.role)) {
    } else {
      where.reviewerId = ctx.state.user.id
    }

    const { count, rows } = await Review.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      include: [
        { model: Annotation, attributes: ['character', 'pinyin', 'meaning'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'username', 'realName'] }
      ]
    })

    ctx.body = {
      reviews: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  } catch (err) {
    logger.error('查询审核列表失败:', err)
    ctx.status = 500
    ctx.body = { error: '查询失败: ' + err.message }
  }
})

router.get('/:id', async (ctx) => {
  const { id } = ctx.params

  try {
    const review = await Review.findByPk(id, {
      include: [
        { model: Annotation, attributes: ['id', 'character', 'pinyin', 'radical', 'meaning'] },
        { model: Rubbing, attributes: ['id', 'title', 'dynasty'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'username', 'realName'] }
      ]
    })

    if (!review) {
      ctx.status = 404
      ctx.body = { error: '审核记录不存在' }
      return
    }

    ctx.body = review
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.post('/:id/review', async (ctx) => {
  if (!['admin', 'expert'].includes(ctx.state.user.role)) {
    ctx.status = 403
    ctx.body = { error: '权限不足，仅专家或管理员可审核' }
    return
  }

  const { id } = ctx.params
  const { status, comments, suggestedData } = ctx.request.body

  if (!['approved', 'rejected', 'needs_revision'].includes(status)) {
    ctx.status = 400
    ctx.body = { error: '无效的审核状态' }
    return
  }

  try {
    const review = await Review.findByPk(id)
    if (!review) {
      ctx.status = 404
      ctx.body = { error: '审核记录不存在' }
      return
    }

    if (review.status !== 'pending') {
      ctx.status = 400
      ctx.body = { error: '该审核已处理' }
      return
    }

    await review.update({
      status,
      comments,
      suggestedData,
      reviewedAt: new Date()
    })

    const annotation = await Annotation.findByPk(review.annotationId)
    if (annotation) {
      let newStatus = annotation.status
      if (status === 'approved') {
        newStatus = 'reviewed'
        if (suggestedData) {
          await annotation.update({
            character: suggestedData.character || annotation.character,
            pinyin: suggestedData.pinyin || annotation.pinyin,
            radical: suggestedData.radical || annotation.radical,
            meaning: suggestedData.meaning || annotation.meaning,
            strokeCount: suggestedData.strokeCount || annotation.strokeCount
          })
        }
      } else if (status === 'rejected') {
        newStatus = 'draft'
      } else if (status === 'needs_revision') {
        newStatus = 'needs_revision'
      }
      await annotation.update({ status: newStatus })
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'review_annotation',
      module: 'review',
      description: `审核释读: ${annotation?.character || ''}, 结果: ${status}`
    })

    ctx.body = { message: '审核完成', review }
  } catch (err) {
    logger.error('审核失败:', err)
    ctx.status = 500
    ctx.body = { error: '审核失败: ' + err.message }
  }
})

router.get('/stats/summary', async (ctx) => {
  try {
    const [total, byStatus, byPriority] = await Promise.all([
      Review.count(),
      Review.findAll({
        attributes: ['status', [Op.fn('COUNT'), '*'], 'count']],
        group: ['status'],
        raw: true
      }),
      Review.findAll({
        attributes: ['priority', [Op.fn('COUNT'), '*'], 'count']],
        group: ['priority'],
        raw: true
      })
    ])

    const pending = await Review.count({ where: { status: 'pending' } })
    const approved = await Review.count({ where: { status: 'approved' } })

    ctx.body = {
      total,
      pending,
      approved,
      byStatus,
      byPriority
    }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '统计失败' }
  }
})

router.get('/rubbing/:rubbingId/reviews', async (ctx) => {
  const { rubbingId } = ctx.params
  const { status } = ctx.query

  try {
    const where = { rubbingId }
    if (status) where.status = status

    const reviews = await Review.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Annotation, attributes: ['character', 'pinyin', 'meaning'] },
        { model: User, as: 'Reviewer', attributes: ['username', 'realName'] }
      ]
    })

    ctx.body = { reviews }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.post('/batch/review', async (ctx) => {
  if (!['admin', 'expert'].includes(ctx.state.user.role)) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { reviewIds, status, comments } = ctx.request.body

  if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
    ctx.status = 400
    ctx.body = { error: '请选择要审核的记录' }
    return
  }

  try {
    const reviews = await Review.findAll({
      where: {
        id: { [Op.in]: reviewIds },
        status: 'pending'
      }
    })

    for (const review of reviews) {
      await review.update({
        status,
        comments,
        reviewedAt: new Date()
      })

      const annotation = await Annotation.findByPk(review.annotationId)
      if (annotation) {
        const newStatus = status === 'approved' ? 'reviewed' : 'draft'
        await annotation.update({ status: newStatus })
      }
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'batch_review',
      module: 'review',
      description: `批量审核${reviews.length}条释读，结果: ${status}`
    })

    ctx.body = {
      message: '批量审核完成',
      processedCount: reviews.length
    }
  } catch (err) {
    logger.error('批量审核失败:', err)
    ctx.status = 500
    ctx.body = { error: '审核失败: ' + err.message }
  }
})

module.exports = router
