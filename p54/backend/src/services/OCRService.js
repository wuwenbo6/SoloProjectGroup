const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')
const path = require('path')
const Tesseract = require('tesseract.js')
const sharp = require('sharp')
const logger = require('../utils/logger')

class OCRTaskQueue {
  constructor(workerCount = 2) {
    this.workerCount = workerCount
    this.queue = []
    this.activeWorkers = 0
    this.workers = []
    this.results = new Map()
    this.processing = new Set()
  }

  addTask(taskId, imagePath, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        taskId,
        imagePath,
        options,
        resolve,
        reject,
        createdAt: Date.now()
      })
      logger.info(`OCR任务已入队: ${taskId}, 队列长度: ${this.queue.length}`)
      this.processQueue()
    })
  }

  processQueue() {
    if (this.activeWorkers >= this.workerCount || this.queue.length === 0) {
      return
    }

    const task = this.queue.shift()
    this.activeWorkers++
    this.processing.add(task.taskId)

    this.processTask(task)
      .then(result => {
        task.resolve(result)
      })
      .catch(err => {
        task.reject(err)
      })
      .finally(() => {
        this.activeWorkers--
        this.processing.delete(task.taskId)
        this.processQueue()
      })
  }

  async processTask(task) {
    const { taskId, imagePath, options } = task
    const startTime = Date.now()

    logger.info(`开始处理OCR任务: ${taskId}`)

    try {
      const processedImage = await this.preprocessImage(imagePath, options)

      const worker = await Tesseract.createWorker('chi_tra', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR进度 ${taskId}: ${(m.progress * 100).toFixed(1)}%`)
          }
        },
        errorHandler: err => {
          logger.error(`Tesseract错误 ${taskId}:`, err)
        }
      })

      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: '1',
        textord_heavy_nr: '1',
        textord_min_linesize: 2.5
      })

      const result = await worker.recognize(processedImage)
      await worker.terminate()

      const words = this.postProcessResult(result.data.words, options)
      const duration = Date.now() - startTime

      logger.info(`OCR任务完成: ${taskId}, 识别${words.length}字, 耗时${duration}ms`)

      return {
        taskId,
        words,
        confidence: result.data.confidence,
        duration,
        text: result.data.text
      }
    } catch (err) {
      logger.error(`OCR任务失败: ${taskId}`, err)
      throw err
    }
  }

  async preprocessImage(imagePath, options = {}) {
    const {
      denoiseLevel = 50,
      contrastLevel = 30,
      threshold = 0,
      scale = 2
    } = options

    let image = sharp(imagePath)

    if (scale !== 1) {
      image = image.resize({
        width: Math.round(1000 * scale),
        height: Math.round(1000 * scale),
        fit: 'inside',
        withoutEnlargement: false
      })
    }

    image = image
      .grayscale()
      .normalize()

    if (denoiseLevel > 0) {
      const sigma = 0.3 + (denoiseLevel / 100) * 1.5
      image = image.sharpen({ sigma, flat: false })
      const medianSize = Math.max(1, Math.floor(denoiseLevel / 30))
      if (medianSize >= 3) {
        image = image.median(medianSize)
      }
    }

    if (contrastLevel > 0) {
      const factor = 1 + (contrastLevel / 100) * 2
      image = image.linear(factor, -(128 * (factor - 1)))
    }

    if (threshold > 0) {
      image = image.threshold(threshold)
    }

    const buffer = await image.toFormat('png').toBuffer()
    return buffer
  }

  postProcessResult(words, options = {}) {
    const { minConfidence = 30, mergeNearby = true } = options

    return words
      .filter(word => word.confidence >= minConfidence)
      .filter(word => word.text.trim().length > 0)
      .map(word => ({
        text: word.text.replace(/[^\u4e00-\u9fa5\u3400-\u4dbfA-Za-z0-9]/g, ''),
        confidence: word.confidence,
        boundingBox: {
          left: word.bbox.x0,
          top: word.bbox.y0,
          right: word.bbox.x1,
          bottom: word.bbox.y1,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0
        },
        line: word.line || 0,
        wordIndex: word.block_idx || 0
      }))
      .filter(word => word.text.length > 0)
  }

  getQueueStatus() {
    return {
      queued: this.queue.length,
      active: this.activeWorkers,
      processing: Array.from(this.processing),
      workerCount: this.workerCount
    }
  }

  shutdown() {
    this.workers.forEach(w => w.terminate())
    this.workers = []
  }
}

const ocrQueue = new OCRTaskQueue(2)

module.exports = {
  OCRTaskQueue,
  ocrQueue
}
