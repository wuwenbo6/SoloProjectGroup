export interface EnhanceParams {
  brightness: number
  contrast: number
  sharpness: number
  threshold: number
  denoise: number
}

const createCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  return canvas
}

const getImageData = (canvas: HTMLCanvasElement, img: HTMLImageElement): ImageData => {
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

const putImageData = (canvas: HTMLCanvasElement, imageData: ImageData): void => {
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const adjustBrightness = (imageData: ImageData, brightness: number): ImageData => {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + brightness, 0, 255)
    data[i + 1] = clamp(data[i + 1] + brightness, 0, 255)
    data[i + 2] = clamp(data[i + 2] + brightness, 0, 255)
  }
  return imageData
}

export const adjustContrast = (imageData: ImageData, contrast: number): ImageData => {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128, 0, 255)
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128, 0, 255)
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128, 0, 255)
  }
  return imageData
}

export const adjustSharpness = (imageData: ImageData, amount: number): ImageData => {
  if (amount <= 0) return imageData
  
  const { width, height, data } = imageData
  const result = new Uint8ClampedArray(data)
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        const idx = (y * width + x) * 4 + c
        result[idx] = clamp(data[idx] + (sum - data[idx]) * amount, 0, 255)
      }
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i]
  }
  return imageData
}

export const applyThreshold = (imageData: ImageData, threshold: number): ImageData => {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const grayscale = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    const value = grayscale > threshold ? 255 : 0
    data[i] = data[i + 1] = data[i + 2] = value
  }
  return imageData
}

export const applyDenoise = (imageData: ImageData, strength: number): ImageData => {
  if (strength <= 0) return imageData
  
  const { width, height, data } = imageData
  const result = new Uint8ClampedArray(data)
  const radius = Math.ceil(strength)
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        let count = 0
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            sum += data[idx]
            count++
          }
        }
        const idx = (y * width + x) * 4 + c
        result[idx] = Math.round(sum / count)
      }
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i]
  }
  return imageData
}

export const detectEdges = (imageData: ImageData): ImageData => {
  const { width, height, data } = imageData
  const result = new Uint8ClampedArray(data.length)
  
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gxR = 0, gxG = 0, gxB = 0
      let gyR = 0, gyG = 0, gyB = 0
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const ki = (ky + 1) * 3 + (kx + 1)
          gxR += data[idx] * sobelX[ki]
          gxG += data[idx + 1] * sobelX[ki]
          gxB += data[idx + 2] * sobelX[ki]
          gyR += data[idx] * sobelY[ki]
          gyG += data[idx + 1] * sobelY[ki]
          gyB += data[idx + 2] * sobelY[ki]
        }
      }
      
      const idx = (y * width + x) * 4
      result[idx] = clamp(Math.sqrt(gxR * gxR + gyR * gyR), 0, 255)
      result[idx + 1] = clamp(Math.sqrt(gxG * gxG + gyG * gyG), 0, 255)
      result[idx + 2] = clamp(Math.sqrt(gxB * gxB + gyB * gyB), 0, 255)
      result[idx + 3] = data[idx + 3]
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i]
  }
  return imageData
}

export const enhanceImage = (img: HTMLImageElement, params: EnhanceParams): string => {
  const canvas = createCanvas(img)
  let imageData = getImageData(canvas, img)
  
  if (params.brightness !== 0) {
    imageData = adjustBrightness(imageData, params.brightness)
  }
  if (params.contrast !== 0) {
    imageData = adjustContrast(imageData, params.contrast)
  }
  if (params.sharpness > 0) {
    imageData = adjustSharpness(imageData, params.sharpness)
  }
  if (params.threshold > 0) {
    imageData = applyThreshold(imageData, params.threshold)
  }
  if (params.denoise > 0) {
    imageData = applyDenoise(imageData, params.denoise)
  }
  
  putImageData(canvas, imageData)
  return canvas.toDataURL('image/jpeg', 0.95)
}

export const createPresets = (): Record<string, EnhanceParams> => ({
  original: { brightness: 0, contrast: 0, sharpness: 0, threshold: 0, denoise: 0 },
  enhance: { brightness: 20, contrast: 30, sharpness: 0.5, threshold: 0, denoise: 1 },
  binary: { brightness: 0, contrast: 50, sharpness: 0.3, threshold: 128, denoise: 2 },
  scan: { brightness: 10, contrast: 40, sharpness: 0.8, threshold: 0, denoise: 1 },
  carving: { brightness: -10, contrast: 60, sharpness: 1, threshold: 0, denoise: 2 }
})

export const presetNames: Record<string, string> = {
  original: '原图',
  enhance: '增强',
  binary: '二值化',
  scan: '扫描',
  carving: '碑文'
}
