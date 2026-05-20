export interface ProcessedImage {
  file: File
  width: number
  height: number
  thumbnail: string
}

export const processImage = (file: File): Promise<ProcessedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        const maxWidth = 4096
        const maxHeight = 4096
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }
        
        canvas.width = width
        canvas.height = height
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)
        }
        
        const thumbnailCanvas = document.createElement('canvas')
        const thumbSize = 200
        const thumbRatio = Math.min(thumbSize / img.width, thumbSize / img.height)
        thumbnailCanvas.width = Math.floor(img.width * thumbRatio)
        thumbnailCanvas.height = Math.floor(img.height * thumbRatio)
        const thumbCtx = thumbnailCanvas.getContext('2d')
        if (thumbCtx) {
          thumbCtx.imageSmoothingEnabled = true
          thumbCtx.imageSmoothingQuality = 'medium'
          thumbCtx.drawImage(img, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve({
              file: processedFile,
              width,
              height,
              thumbnail: thumbnailCanvas.toDataURL('image/jpeg', 0.7)
            })
          } else {
            reject(new Error('图片处理失败'))
          }
        }, 'image/jpeg', 0.92)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export const calculateRelativePosition = (
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  imageRect: { width: number; height: number; offsetLeft: number; offsetTop: number }
) => {
  const scaleX = imageRect.width / containerRect.width
  const scaleY = imageRect.height / containerRect.height
  const scale = Math.max(scaleX, scaleY)
  
  const actualWidth = containerRect.width * scale
  const actualHeight = containerRect.height * scale
  const offsetX = (containerRect.width - actualWidth) / 2
  const offsetY = (containerRect.height - actualHeight) / 2
  
  const relativeX = (clientX - containerRect.left - offsetX) / actualWidth
  const relativeY = (clientY - containerRect.top - offsetY) / actualHeight
  
  return { x: Math.max(0, Math.min(1, relativeX)), y: Math.max(0, Math.min(1, relativeY)) }
}
