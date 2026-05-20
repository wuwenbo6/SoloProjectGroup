const fs = require('fs').promises
const path = require('path')
const sharp = require('sharp')
const logger = require('../utils/logger')

const STORAGE_TIERS = {
  HOT: 'hot',
  COLD: 'cold',
  ARCHIVE: 'archive'
}

const STORAGE_CONFIG = {
  [STORAGE_TIERS.HOT]: {
    path: 'uploads/hot',
    quality: 90,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    versions: ['original', 'preview', 'thumbnail']
  },
  [STORAGE_TIERS.COLD]: {
    path: 'uploads/cold',
    quality: 70,
    maxAge: 90 * 24 * 60 * 60 * 1000,
    versions: ['preview', 'thumbnail']
  },
  [STORAGE_TIERS.ARCHIVE]: {
    path: 'uploads/archive',
    quality: 60,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    versions: ['thumbnail']
  }
}

class StorageService {
  constructor() {
    this.basePath = path.join(__dirname, '../../')
    this.init()
  }

  async init() {
    for (const tier of Object.values(STORAGE_CONFIG)) {
      const fullPath = path.join(this.basePath, tier.path)
      await fs.mkdir(fullPath, { recursive: true })
    }
    logger.info('存储服务初始化完成')
  }

  async storeImage(fileBuffer, filename, options = {}) {
    const { tier = STORAGE_TIERS.HOT, rubbingId = 'unknown' } = options
    const config = STORAGE_CONFIG[tier]

    const results = {}
    const timestamp = Date.now()

    for (const version of config.versions) {
      const versionDir = path.join(this.basePath, config.path, rubbingId)
      await fs.mkdir(versionDir, { recursive: true })

      const versionFilename = `${version}-${timestamp}-${filename}`
      const filePath = path.join(versionDir, versionFilename)

      let image = sharp(fileBuffer)

      switch (version) {
        case 'original':
          await image.toFile(filePath)
          break
        case 'preview':
          await image
            .resize({ width: 1200, height: 1200, fit: 'inside' })
            .jpeg({ quality: config.quality })
            .toFile(filePath)
          break
        case 'thumbnail':
          await image
            .resize({ width: 300, height: 300, fit: 'cover' })
            .jpeg({ quality: 60 })
            .toFile(filePath)
          break
      }

      results[version] = {
        path: `/${config.path}/${rubbingId}/${versionFilename}`,
        size: (await fs.stat(filePath)).size
      }
    }

    logger.info(`图片存储完成: ${filename}, tier: ${tier}, versions: ${Object.keys(results).length}`)
    return {
      tier,
      versions: results,
      storedAt: new Date()
    }
  }

  async migrateToTier(filePath, filename, fromTier, toTier, newRubbingId) {
    const fromConfig = STORAGE_CONFIG[fromTier]
    const toConfig = STORAGE_CONFIG[toTier]

    let fromFullPath = path.join(this.basePath, fromConfig.path, filePath)
    if (!fs.existsSync(fromFullPath)) {
      fromFullPath = path.join(this.basePath, fromConfig.path, 'temp', filename)
    }

    const targetDir = newRubbingId ? path.join(this.basePath, toConfig.path, newRubbingId.toString()) : path.dirname(toFullPath)
    const toFullPath = path.join(targetDir, path.basename(filePath))

    try {
      await fs.mkdir(targetDir, { recursive: true })
      await fs.copyFile(fromFullPath, toFullPath)
      await fs.unlink(fromFullPath).catch(() => {})

      logger.info(`文件迁移完成: ${fromTier} -> ${toTier}: ${filename}`)
      return true
    } catch (err) {
      logger.error(`文件迁移失败: ${filename}`, err)
      return false
    }
  }

  async getImageUrl(rubbingId, filename, version = 'preview') {
    const tiers = [STORAGE_TIERS.HOT, STORAGE_TIERS.COLD, STORAGE_TIERS.ARCHIVE]

    for (const tier of tiers) {
      const config = STORAGE_CONFIG[tier]
      const possiblePath = path.join(this.basePath, config.path, rubbingId, `${version}-${filename}`)

      try {
        await fs.access(possiblePath)
        return `/${config.path}/${rubbingId}/${version}-${filename}`
      } catch {
        continue
      }
    }

    return null
  }

  async getVersions(rubbingId, filename) {
    const versions = {}

    for (const tier of Object.values(STORAGE_CONFIG)) {
      for (const version of tier.versions) {
        const filePath = path.join(this.basePath, tier.path, rubbingId, `${version}-${filename}`)
        try {
          const stats = await fs.stat(filePath)
          versions[version] = {
            path: `/${tier.path}/${rubbingId}/${version}-${filename}`,
            size: stats.size,
            tier: tier.path.split('/')[1]
          }
        } catch {
          continue
        }
      }
    }

    return versions
  }

  async deleteImage(rubbingId, filename) {
    let deleted = 0

    for (const tier of Object.values(STORAGE_CONFIG)) {
      for (const version of tier.versions) {
        const filePath = path.join(this.basePath, tier.path, rubbingId, `${version}-${filename}`)
        try {
          await fs.unlink(filePath)
          deleted++
        } catch {
          continue
        }
      }

      try {
        const dirPath = path.join(this.basePath, tier.path, rubbingId)
        const files = await fs.readdir(dirPath)
        if (files.length === 0) {
          await fs.rmdir(dirPath)
        }
      } catch {}
    }

    logger.info(`删除图片文件: ${rubbingId}, 删除${deleted}个版本`)
    return deleted
  }

  async runCleanupJob() {
    logger.info('开始执行存储清理任务')
    const now = Date.now()

    for (const [tierName, config] of Object.entries(STORAGE_CONFIG)) {
      const tierPath = path.join(this.basePath, config.path)
      const dirs = await fs.readdir(tierPath)

      for (const dir of dirs) {
        const dirFullPath = path.join(tierPath, dir)
        const stats = await fs.stat(dirFullPath)

        if (stats.isDirectory()) {
          const files = await fs.readdir(dirFullPath)

          for (const file of files) {
            const filePath = path.join(dirFullPath, file)
            const fileStats = await fs.stat(filePath)
            const age = now - fileStats.mtime.getTime()

            if (age > config.maxAge && tierName === STORAGE_TIERS.HOT) {
              await this.migrateToTier(filePath, file, STORAGE_TIERS.HOT, STORAGE_TIERS.COLD)
              logger.info(`自动迁移到冷存储: ${file}`)
            }
          }
        }
      }
    }

    logger.info('存储清理任务完成')
  }

  async getStorageStats() {
    const stats = {}

    for (const [tierName, config] of Object.entries(STORAGE_CONFIG)) {
      let totalSize = 0
      let fileCount = 0

      const tierPath = path.join(this.basePath, config.path)
      const dirs = await fs.readdir(tierPath).catch(() => [])

      for (const dir of dirs) {
        const dirPath = path.join(tierPath, dir)
        const files = await fs.readdir(dirPath).catch(() => [])

        for (const file of files) {
          const filePath = path.join(dirPath, file)
          const fileStats = await fs.stat(filePath).catch(() => null)
          if (fileStats) {
            totalSize += fileStats.size
            fileCount++
          }
        }
      }

      stats[tierName] = {
        fileCount,
        totalSize: Math.round(totalSize / 1024),
        path: config.path
      }
    }

    return stats
  }
}

const storageService = new StorageService()

setInterval(() => {
  storageService.runCleanupJob().catch(err => {
    logger.error('存储清理任务失败:', err)
  })
}, 24 * 60 * 60 * 1000)

module.exports = {
  StorageService,
  storageService,
  STORAGE_TIERS
}
