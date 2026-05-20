const Koa = require('koa')
const cors = require('@koa/cors')
const { koaBody } = require('koa-body')
const serve = require('koa-static')
const compress = require('koa-compress')
const zlib = require('zlib')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')

const logger = require('./utils/logger')
const db = require('./models')
const authMiddleware = require('./middleware/auth')
const cacheMiddleware = require('./middleware/cache')
const socketHandler = require('./socket')

const rubbingRoutes = require('./routes/rubbing')
const userRoutes = require('./routes/user')
const annotationRoutes = require('./routes/annotation')
const ocrRoutes = require('./routes/ocr')
const dictionaryRoutes = require('./routes/dictionary')
const museumRoutes = require('./routes/museum')
const reviewRoutes = require('./routes/review')

const app = new Koa()
const server = http.createServer(app.callback())
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

app.use(cors({
  origin: '*',
  credentials: true
}))

app.use(compress({
  filter: (contentType) => /text|json|javascript|css|xml|svg/.test(contentType),
  threshold: 2048,
  gzip: {
    flush: zlib.constants.Z_SYNC_FLUSH,
    level: zlib.constants.Z_BEST_SPEED
  },
  deflate: {
    flush: zlib.constants.Z_SYNC_FLUSH
  },
  br: false
}))

app.use(koaBody({
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '../uploads/rubbings'),
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024
  }
}))

app.use(serve(path.join(__dirname, '../uploads'), {
  maxage: 7 * 24 * 60 * 60 * 1000,
  immutable: true,
  setHeaders: (res, path) => {
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
    }
  }
}))

app.use((ctx, next) => {
  ctx.set('X-Content-Type-Options', 'nosniff')
  ctx.set('X-Frame-Options', 'SAMEORIGIN')
  ctx.set('X-XSS-Protection', '1; mode=block')
  return next()
})

app.use(cacheMiddleware)

app.use(async (ctx, next) => {
  const start = Date.now()
  try {
    await next()
    const ms = Date.now() - start
    logger.info(`${ctx.method} ${ctx.url} - ${ms}ms`)
  } catch (err) {
    logger.error(`${ctx.method} ${ctx.url} - ${err.message}`)
    ctx.status = err.status || 500
    ctx.body = { error: err.message }
  }
})

app.use(authMiddleware.unless({
  path: [/^\/api\/user\/login/, /^\/api\/user\/register/]
}))

app.use(rubbingRoutes.routes()).use(rubbingRoutes.allowedMethods())
app.use(userRoutes.routes()).use(userRoutes.allowedMethods())
app.use(annotationRoutes.routes()).use(annotationRoutes.allowedMethods())
app.use(ocrRoutes.routes()).use(ocrRoutes.allowedMethods())
app.use(dictionaryRoutes.routes()).use(dictionaryRoutes.allowedMethods())
app.use(museumRoutes.routes()).use(museumRoutes.allowedMethods())
app.use(reviewRoutes.routes()).use(reviewRoutes.allowedMethods())

socketHandler(io)

const PORT = process.env.PORT || 3000

db.sequelize.sync({ alter: true }).then(() => {
  logger.info('Database synchronized')
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`)
  })
})

module.exports = { app, server, io }
