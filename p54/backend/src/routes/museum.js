const Router = require('koa-router')
const { Op, QueryTypes } = require('sequelize')
const MuseumCollection = require('../models/MuseumCollection')
const Rubbing = require('../models/Rubbing')
const OperationLog = require('../models/OperationLog')
const logger = require('../utils/logger')
const sequelize = require('../models/index')

const router = new Router({ prefix: '/api/museum' })

const sampleMuseumData = [
  {
    museumCode: 'npm',
    museumName: '中国国家博物馆',
    collectionNo: 'NPM-B-001',
    title: '毛公鼎铭文拓片',
    originalTitle: '毛公鼎',
    dynasty: '西周',
    era: '宣王时期',
    scriptType: '金文',
    category: '金文',
    material: '铜',
    author: '毛公',
    location: '陕西岐山',
    rubbingsDate: '清晚期拓本',
    rubbingsType: '原拓',
    size: '高53.8cm，口径47.9cm',
    description: '毛公鼎，西周晚期青铜器，因作器者毛公而得名。铭文497字，为现存商周青铜器铭文最长者。',
    contentPreview: '王若曰：父歆，丕显文武，皇天引厌劂德，配我有周，膺受大命...',
    charactersCount: 497,
    preservation: '完好',
    tags: ['重器', '长篇铭文', '西周'],
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'npm',
    museumName: '中国国家博物馆',
    collectionNo: 'NPM-B-002',
    title: '大盂鼎铭文拓片',
    originalTitle: '大盂鼎',
    dynasty: '西周',
    era: '康王时期',
    scriptType: '金文',
    category: '金文',
    material: '铜',
    author: '盂',
    location: '陕西郿县',
    rubbingsDate: '民国拓本',
    rubbingsType: '原拓',
    size: '通高101.9cm，口径77.8cm',
    description: '大盂鼎，西周康王时期重器，铭文291字，记载周王策命盂的史实。',
    contentPreview: '隹九月，王才宗周，令盂。王若曰：盂，丕显玟王受天有大令...',
    charactersCount: 291,
    preservation: '完好',
    tags: ['重器', '策命文书', '西周'],
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'npm',
    museumName: '中国国家博物馆',
    collectionNo: 'NPM-S-001',
    title: '石鼓文拓片（先锋本）',
    originalTitle: '石鼓文',
    dynasty: '战国',
    era: '秦国',
    scriptType: '大篆',
    category: '碑',
    material: '石',
    location: '陕西宝鸡',
    rubbingsDate: '清乾隆拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    charactersCount: 718,
    tags: ['石鼓', '石刻之祖', '秦刻石'],
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'npm',
    museumName: '中国国家博物馆',
    collectionNo: 'NPM-T-003',
    title: '曹全碑拓片（明初拓本）',
    originalTitle: '郃阳令曹全碑',
    dynasty: '东汉',
    era: '中平二年',
    scriptType: '隶书',
    category: '碑',
    material: '石',
    author: '王敞等',
    location: '郃阳故城',
    rubbingsDate: '明初拓本',
    rubbingsType: '原拓',
    size: '高253cm，宽123cm',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'gugong',
    museumName: '故宫博物院',
    collectionNo: 'GUGONG-B-001',
    title: '礼器碑拓片（明拓本）',
    originalTitle: '汉鲁相韩敕造孔庙礼器碑',
    dynasty: '东汉',
    era: '永寿二年',
    scriptType: '隶书',
    category: '碑',',
    material: '石',
    author: '韩敕',
    rubbingsDate: '明拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'gugong',
    museumName: '故宫博物院',
    collectionNo: 'GUGONG-B-002',
    title: '张迁碑拓片（明拓本）',
    originalTitle: '汉故谷城长荡阴令张君表颂',
    dynasty: '东汉',
    era: '中平三年',
    scriptType: '隶书',
    category: '碑',',
    material: '石',',
    rubbingsDate: '明拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'shanghailibrary',
    museumName: '上海博物馆',
    collectionNo: 'SHM-B-001',
    title: '大克鼎铭文拓片',
    originalTitle: '大克鼎',
    dynasty: '西周',
    era: '孝王时期',
    scriptType: '金文',',
    category: '金文',',
    material: '铜',',
    author: '克',',
    location: '陕西扶风',
    rubbingsDate: '清拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'shanghailibrary',
    museumName: '上海博物馆',
    collectionNo: 'SHM-T-001',
    title: '熹平石经拓片（残石）',
    originalTitle: '汉熹平石经',',
    dynasty: '东汉',
    era: '熹平四年',
    scriptType: '隶书',
    category: '经幢',
    material: '石',',
    rubbingsDate: '民初拓本',
    rubbingsType: '原拓',
    preservation: '残损',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'luoyang',
    museumName: '洛阳博物馆',
    collectionNo: 'LY-T-001',
    title: '龙门二十品拓片',
    originalTitle: '龙门二十品',
    dynasty: '北魏',
    era: '太和至景明年间',
    scriptType: '魏碑',
    category: '造像记',',
    material: '石',',
    location: '河南洛阳龙门石窟',',
    rubbingsDate: '清拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'luoyang',
    museumName: '洛阳博物馆',
    collectionNo: 'LY-M-001',
    title: '元桢墓志拓片',
    originalTitle: '魏故使持节镇北大将军相州刺史南安王桢墓志铭',
    dynasty: '北魏',
    era: '太和二十年',
    scriptType: '魏碑',
    category: '墓志',',
    material: '石',',
    location: '河南洛阳',
    rubbingsDate: '民国拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'xian',
    museumName: '西安碑林博物馆',
    collectionNo: 'XAB-T-001',
    title: '峄山碑拓片（明拓本）',
    originalTitle: '秦峄山碑',',
    dynasty: '秦',
    era: '始皇二十八年',
    scriptType: '小篆',
    category: '碑',',
    material: '石',',
    location: '山东邹城',
    rubbingsDate: '明拓本',
    rubbingsType: '翻拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  },
  {
    museumCode: 'xian',
    museumName: '西安碑林博物馆',
    collectionNo: 'XAB-T-002',
    title: '多宝塔碑拓片（宋拓本）',
    originalTitle: '大唐西京千福寺多宝佛塔感应碑',
    dynasty: '唐',
    era: '天宝十一年',
    scriptType: '楷书',',
    category: '碑',',
    material: '石',',
    author: '颜真卿书',',
    rubbingsDate: '宋拓本',
    rubbingsType: '原拓',
    preservation: '完好',
    isPublished: true,
    syncStatus: 'synced'
  }
]

router.post('/sync', async (ctx) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: '权限不足，仅管理员可执行同步' }
    return
  }

  const { museumCode, startIndex = 0, limit = 50 } = ctx.request.body

  try {
    let syncedCount = 0
    let createdCount = 0
    let updatedCount = 0

    const dataToSync = museumCode
      ? sampleMuseumData.filter(item => item.museumCode === museumCode)
      : sampleMuseumData

    const itemsToProcess = dataToSync.slice(startIndex, startIndex + limit)

    for (const item of itemsToProcess) {
      const existing = await MuseumCollection.findOne({
        where: {
          museumCode: item.museumCode,
          collectionNo: item.collectionNo
        }
      })

      if (existing) {
        await existing.update({
          ...item,
          syncStatus: 'synced',
          lastSyncAt: new Date()
        })
        updatedCount++
      } else {
        await MuseumCollection.create({
          ...item,
          lastSyncAt: new Date()
        })
        createdCount++
      }
      syncedCount++
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'museum_sync',
      module: 'museum',
      description: `同步博物馆馆藏数据，新增${createdCount}条，更新${updatedCount}条`
    })

    ctx.body = {
      message: '同步成功',
      syncedCount,
      createdCount,
      updatedCount
    }
  } catch (err) {
    logger.error('同步馆藏数据失败:', err)
    ctx.status = 500
    ctx.body = { error: '同步失败: ' + err.message }
  }
})

router.get('/list', async (ctx) => {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    dynasty,
    scriptType,
    category,
    material,
    museumCode,
    scriptCategory,
    scriptStyle,
    author
  } = ctx.query

  try {
    const where = { isPublished: true }

    if (museumCode) where.museumCode = museumCode
    if (dynasty) where.dynasty = dynasty
    if (scriptType) where.scriptType = scriptType
    if (category) where.category = category
    if (material) where.material = material
    if (scriptCategory) where.scriptCategory = scriptCategory
    if (scriptStyle) where.scriptStyle = scriptStyle
    if (author) where.author = { [Op.like]: `%${author}%` }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { originalTitle: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { contentPreview: { [Op.like]: `%${keyword}%` } },
        { tags: { [Op.like]: `%${keyword}%` } }
      ]
    }

    const { count, rows } = await MuseumCollection.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order: [['dynasty', 'ASC'], ['collectionNo', 'ASC']],
      attributes: {
        exclude: ['metadata']
      }
    })

    ctx.body = {
      collections: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  } catch (err) {
    logger.error('查询馆藏列表失败:', err)
    ctx.status = 500
    ctx.body = { error: '查询失败: ' + err.message }
  }
})

router.get('/:id', async (ctx) => {
  const { id } = ctx.params

  try {
    const collection = await MuseumCollection.findByPk(id)
    if (!collection) {
      ctx.status = 404
      ctx.body = { error: '馆藏记录不存在' }
      return
    }

    ctx.body = collection
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.get('/filters/options', async (ctx) => {
  try {
    const [dynasties, scriptTypes, categories, materials, museums] = await Promise.all([
      MuseumCollection.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('dynasty')), 'dynasty'],
        where: { dynasty: { [Op.ne]: null } },
        raw: true
      }),
      MuseumCollection.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('scriptType')), 'scriptType'],
        where: { scriptType: { [Op.ne]: null } },
        raw: true
      }),
      MuseumCollection.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category'],
        where: { category: { [Op.ne]: null } },
        raw: true
      }),
      MuseumCollection.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('material')), 'material'],
        where: { material: { [Op.ne]: null } },
        raw: true
      }),
      MuseumCollection.findAll({
        attributes: [
          [sequelize.fn('DISTINCT', sequelize.col('museumCode')), 'museumCode'],
          'museumName'
        ],
        where: { museumCode: { [Op.ne]: null } },
        raw: true
      })
    ])

    ctx.body = {
      dynasties: dynasties.map(d => d.dynasty).filter(Boolean),
      scriptTypes: scriptTypes.map(s => s.scriptType).filter(Boolean),
      categories: categories.map(c => c.category).filter(Boolean),
      materials: materials.map(m => m.material).filter(Boolean),
      museums: museums.map(m => ({ code: m.museumCode, name: m.museumName })).filter(Boolean)
    }
  } catch (err) {
    logger.error('获取筛选选项失败:', err)
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.post('/:id/import', async (ctx) => {
  if (!['admin', 'expert'].includes(ctx.state.user.role)) {
    ctx.status = 403
    ctx.body = { error: '权限不足' }
    return
  }

  const { id } = ctx.params

  try {
    const collection = await MuseumCollection.findByPk(id)
    if (!collection) {
      ctx.status = 404
      ctx.body = { error: '馆藏记录不存在' }
      return
    }

    const rubbing = await Rubbing.create({
      title: collection.title,
      description: collection.description,
      category: collection.category,
      dynasty: collection.dynasty,
      author: collection.author,
      era: collection.era,
      location: collection.location,
      sourceType: 'museum',
      originalImage: collection.imageUrl,
      processedImage: collection.imageUrl,
      uploaderId: ctx.state.user.id,
      totalCharacters: collection.charactersCount,
      status: 'uploaded',
      annotationProgress: 0,
      metadata: {
        museumSource: {
          museumCode: collection.museumCode,
          museumName: collection.museumName,
          collectionNo: collection.collectionNo
        },
        scriptType: collection.scriptType,
        material: collection.material,
        rubbingsType: collection.rubbingsType,
        rubbingsDate: collection.rubbingsDate,
        size: collection.size,
        originalTitle: collection.originalTitle,
        contentPreview: collection.contentPreview,
        tags: collection.tags
      }
    })

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'import_from_museum',
      module: 'rubbing',
      description: `从博物馆馆藏导入拓片: ${rubbing.title}`
    })

    ctx.body = {
      message: '导入成功',
      rubbingId: rubbing.id
    }
  } catch (err) {
    logger.error('导入馆藏失败:', err)
    ctx.status = 500
    ctx.body = { error: '导入失败: ' + err.message }
  }
})

router.get('/stats/summary', async (ctx) => {
  try {
    const total = await MuseumCollection.count()
    const byDynasty = await MuseumCollection.findAll({
      attributes: ['dynasty', [sequelize.fn('COUNT', '*'), 'count']],
      group: ['dynasty'],
      raw: true
    })
    const byScriptType = await MuseumCollection.findAll({
      attributes: ['scriptType', [sequelize.fn('COUNT', '*'), 'count']],
      group: ['scriptType'],
      raw: true
    })
    const byCategory = await MuseumCollection.findAll({
      attributes: ['category', [sequelize.fn('COUNT', '*'), 'count']],
      group: ['category'],
      raw: true
    })
    const byMuseum = await MuseumCollection.findAll({
      attributes: ['museumCode', 'museumName', [sequelize.fn('COUNT', '*'), 'count']],
      group: ['museumCode', 'museumName'],
      raw: true
    })

    ctx.body = {
      total,
      byDynasty,
      byScriptType,
      byCategory,
      byMuseum
    }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '统计失败' }
  }
})

router.get('/search/advanced', async (ctx) => {
  const {
    keyword,
    dynastyStart,
    dynastyEnd,
    scriptType,
    category,
    material,
    hasImage,
    inscriptCountMin,
    inscriptCountMax,
    sortBy = 'dynasty',
    sortOrder = 'ASC',
    page = 1,
    pageSize = 20
  } = ctx.query

  try {
    const where = { isPublished: true }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { originalTitle: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { contentPreview: { [Op.like]: `%${keyword}%` } }
      ]
    }

    if (scriptType) where.scriptType = scriptType
    if (category) where.category = category
    if (material) where.material = material

    if (dynastyStart || dynastyEnd) {
      const dynastyOrder = ['商', '西周', '东周', '春秋', '战国', '秦', '西汉', '东汉', '三国', '西晋', '东晋', '南北朝', '隋', '唐', '五代', '宋', '元', '明', '清', '民国']
      const startIdx = dynastyStart ? dynastyOrder.indexOf(dynastyStart) : 0
      const endIdx = dynastyEnd ? dynastyOrder.indexOf(dynastyEnd) : dynastyOrder.length - 1
      where.dynasty = { [Op.in]: dynastyOrder.slice(startIdx, endIdx + 1) }
    }

    if (inscriptCountMin || inscriptCountMax) {
      where.charactersCount = {}
      if (inscriptCountMin) where.charactersCount[Op.gte] = parseInt(inscriptCountMin)
      if (inscriptCountMax) where.charactersCount[Op.lte] = parseInt(inscriptCountMax)
    }

    if (hasImage === 'true') {
      where.imageUrl = { [Op.ne]: null }
    }

    const order = []
    if (sortBy === 'dynasty') {
      order.push([sequelize.literal(`FIELD(dynasty, '商', '西周', '东周', '春秋', '战国', '秦', '西汉', '东汉', '三国', '西晋', '东晋', '南北朝', '隋', '唐', '五代', '宋', '元', '明', '清', '民国')`), sortOrder]
    } else {
      order.push([sortBy, sortOrder])
    }

    const { count, rows } = await MuseumCollection.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      order
    })

    ctx.body = {
      results: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  } catch (err) {
    logger.error('高级搜索失败:', err)
    ctx.status = 500
    ctx.body = { error: '搜索失败: ' + err.message }
  }
})

module.exports = router
