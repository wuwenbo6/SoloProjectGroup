import { useCallback, useRef, useState } from 'react'

export interface ProcessedImage {
  id: string
  name: string
  originalUrl: string
  thumbnailUrl: string
  webpUrl?: string
  width: number
  height: number
  size: number
  processedAt: number
}

export interface UploadProgress {
  id: string
  progress: number
  status: 'pending' | 'processing' | 'uploading' | 'done' | 'error'
}

export const useImageOptimizer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [processing, setProcessing] = useState(false)

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    return canvasRef.current
  }, [])

  const createImageBitmap = useCallback(async (
    file: File,
    maxSize: number = 2048
  ): Promise<ImageBitmap> => {
    const img = await createImageBitmap(file)
    let width = img.width
    let height = img.height

    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const resized = await createImageBitmap(img, 0, 0, img.width, img.height, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high'
    })

    img.close()
    return resized
  }, [])

  const compressToWebP = useCallback((
    bitmap: ImageBitmap,
    quality: number = 0.8
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = getCanvas()
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(bitmap, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('WebP compression failed'))
          }
        },
        'image/webp',
        quality
      )
    })
  }, [getCanvas])

  const createThumbnail = useCallback(async (
    bitmap: ImageBitmap,
    size: number = 200
  ): Promise<Blob> => {
    const canvas = getCanvas()
    const scale = Math.min(size / bitmap.width, size / bitmap.height)
    const thumbWidth = Math.round(bitmap.width * scale)
    const thumbHeight = Math.round(bitmap.height * scale)

    canvas.width = thumbWidth
    canvas.height = thumbHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium'
    ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight)

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Thumbnail creation failed')),
        'image/webp',
        0.6
      )
    })
  }, [getCanvas])

  const processImage = useCallback(async (
    file: File,
    options: {
      maxSize?: number
      quality?: number
      createWebP?: boolean
      createThumbnail?: boolean
    } = {}
  ): Promise<ProcessedImage> => {
    const {
      maxSize = 1920,
      quality = 0.85,
      createWebP = true,
      createThumbnail = true
    } = options

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const bitmap = await createImageBitmap(file, maxSize)

      let webpBlob: Blob | undefined
      if (createWebP) {
        webpBlob = await compressToWebP(bitmap, quality)
      }

      let thumbnailBlob: Blob | undefined
      if (createThumbnail) {
        thumbnailBlob = await createThumbnail(bitmap, 200)
      }

      const result: ProcessedImage = {
        id,
        name: file.name,
        originalUrl: URL.createObjectURL(file),
        thumbnailUrl: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : URL.createObjectURL(file),
        webpUrl: webpBlob ? URL.createObjectURL(webpBlob) : undefined,
        width: bitmap.width,
        height: bitmap.height,
        size: webpBlob?.size || file.size,
        processedAt: Date.now()
      }

      bitmap.close()
      return result
    } catch (error) {
      console.error('Image processing failed:', error)
      return {
        id,
        name: file.name,
        originalUrl: URL.createObjectURL(file),
        thumbnailUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
        size: file.size,
        processedAt: Date.now()
      }
    }
  }, [createImageBitmap, compressToWebP, createThumbnail])

  const processImages = useCallback(async (
    files: File[],
    onProgress?: (index: number, total: number) => void
  ): Promise<ProcessedImage[]> => {
    setProcessing(true)
    const results: ProcessedImage[] = []

    for (let i = 0; i < files.length; i++) {
      const result = await processImage(files[i])
      results.push(result)
      onProgress?.(i + 1, files.length)
    }

    setProcessing(false)
    return results
  }, [processImage])

  const releaseObjectUrl = useCallback((url: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }, [])

  const releaseAll = useCallback((images: ProcessedImage[]) => {
    images.forEach(img => {
      releaseObjectUrl(img.originalUrl)
      releaseObjectUrl(img.thumbnailUrl)
      if (img.webpUrl) releaseObjectUrl(img.webpUrl)
    })
  }, [releaseObjectUrl])

  return {
    processing,
    processImage,
    processImages,
    releaseObjectUrl,
    releaseAll,
    compressToWebP,
    createThumbnail
  }
}
