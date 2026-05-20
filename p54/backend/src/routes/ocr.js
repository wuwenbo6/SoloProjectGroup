const Router = require('koa-router')
const { sequelize, OCRResult, Rubbing } = require('../models')
const { ocrQueue } = require('../services/OCRService')
const logger = require('../utils/logger')

const router = new Router({ prefix: '/api/ocr' })

router.post('/:rubbingId/recognize', async (ctx) => {
  const { rubbingId } = ctx.params
  const { language = 'chi_tra', denoiseLevel = 50, contrastLevel = 30, scale = 2 } = ctx.request.body

  try {
    const rubbing = await Rubbing.findByPk(rubbingId)
    if (!rubbing) {
      ctx.status = 404
      ctx.body = { error: '拓片不存在' }
      return
    }

    await rubbing.update({ status: 'processing' })

    const imagePath = rubbing.processedImage || rubbing.originalImage
    const fullPath = `${__dirname}/../../uploads${imagePath}`

    const taskId = `ocr-${rubbingId}-${Date.now()}`
    const result = await ocrQueue.addTask(taskId, fullPath, {
      denoiseLevel,
      contrastLevel,
      scale,
      minConfidence: 30
    })

    await OCRResult.destroy({ where: { rubbingId } })

    const records = result.words.map((word, index) => ({
      rubbingId,
      recognizedText: word.text,
      confidence: word.confidence,
      boundingBox: word.boundingBox,
      position: index,
      lineNumber: word.line,
      status: 'pending'
    }))

    await OCRResult.bulkCreate(records)

    await rubbing.update({
      status: 'annotating',
      totalCharacters: records.length
    })

    ctx.body = {
      message: '识别成功',
      taskId,
      totalCharacters: records.length,
      confidence: result.confidence,
      duration: result.duration
    }
  } catch (err) {
    logger.error('OCR识别失败:', err)
    ctx.status = 500
    ctx.body = { error: 'OCR识别失败: ' + err.message }
  }
})

router.get('/:rubbingId/results', async (ctx) => {
  const { rubbingId } = ctx.params
  const { page = 1, pageSize = 100, status, minConfidence } = ctx.query

  try {
    const where = { rubbingId }
    if (status) where.status = status
    if (minConfidence) where.confidence = { [sequelize.Op.gte]: parseFloat(minConfidence) }

    const { count, rows } = await OCRResult.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order: [['position', 'ASC']]
    })

    ctx.body = {
      results: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.put('/result/:id', async (ctx) => {
  const { id } = ctx.params
  const { verifiedText, status } = ctx.request.body

  try {
    const ocrResult = await OCRResult.findByPk(id)
    if (!ocrResult) {
      ctx.status = 404
      ctx.body = { error: 'OCR结果不存在' }
      return
    }

    await ocrResult.update({
      verifiedText,
      status,
      isVerified: true
    })

    ctx.body = { message: '更新成功' }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '更新失败' }
  }
})

router.get('/statistics/:rubbingId', async (ctx) => {
  const { rubbingId } = ctx.params

  try {
    const [total, verified, pending, confirmed] = await Promise.all([
      OCRResult.count({ where: { rubbingId } }),
      OCRResult.count({ where: { rubbingId, isVerified: true } }),
      OCRResult.count({ where: { rubbingId, status: 'pending' } }),
      OCRResult.count({ where: { rubbingId, status: 'confirmed' } })
    ])

    const avgConfidence = await OCRResult.findOne({
      where: { rubbingId },
      attributes: [[sequelize.fn('AVG', sequelize.col('confidence')), 'avgConfidence']
    })

    ctx.body = {
      total,
      verified,
      pending,
      confirmed,
      avgConfidence: parseFloat(avgConfidence?.dataValues?.avgConfidence || 0)
    }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '统计失败' }
  }
})

router.get('/queue/status', async (ctx) => {
  ctx.body = ocrQueue.getQueueStatus()
})

module.exports = router
