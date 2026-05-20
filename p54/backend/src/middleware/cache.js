const NodeCache = require('node-cache')
const logger = require('../utils/logger')

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  maxKeys: 1000
})

const cacheMiddleware = async (ctx, next) => {
  if (ctx.method !== 'GET') {
    return next()
  }

  const cacheKey = `${ctx.path}-${JSON.stringify(ctx.query)}`

  const cached = cache.get(cacheKey)
  if (cached) {
    logger.info(`Cache hit: ${cacheKey}`)
    ctx.set('X-Cache', 'HIT')
    ctx.body = cached
    return
  }

  await next()

  if (ctx.status === 200 && ctx.body) {
    try {
      const ttl = getCacheTTL(ctx.path)
      cache.set(cacheKey, ctx.body, ttl)
      ctx.set('X-Cache', 'MISS')
      logger.info(`Cache set: ${cacheKey}, TTL: ${ttl}s`)
    } catch (err) {
      logger.warn('Cache set failed:', err)
    }
  }
}

function getCacheTTL(path) {
  if (/\/dictionary\//.test(path)) return 3600
  if (/\/rubbing\/list/.test(path)) return 120
  if (/\/ocr\//.test(path)) return 0
  if (/\/museum\//.test(path)) return 1800
  if (/\/review\//.test(path)) return 0
  return 60
}

function invalidateCache(pattern) {
  const keys = cache.keys()
  const regex = new RegExp(pattern)
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.del(key)
      logger.info(`Cache invalidated: ${key}`)
    }
  })
}

function clearCache() {
  cache.flushAll()
  logger.info('All cache cleared')
}

module.exports = cacheMiddleware
module.exports.invalidateCache = invalidateCache
module.exports.clearCache = clearCache
