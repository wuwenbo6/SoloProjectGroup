import { ref, computed } from 'vue'

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) => {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn(...args)
    }
  }
}

export const rafThrottle = <T extends (...args: any[]) => any>(
  fn: T
): ((...args: Parameters<T>) => void) => {
  let locked = false
  return (...args: Parameters<T>) => {
    if (locked) return
    locked = true
    requestAnimationFrame(() => {
      fn(...args)
      locked = false
    })
  }
}

export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>()
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

export const createChunkProcessor = <T>(
  items: T[],
  processor: (item: T, index: number) => void,
  chunkSize: number = 50,
  delay: number = 16
) => {
  let index = 0
  let isRunning = false

  const processChunk = () => {
    const end = Math.min(index + chunkSize, items.length)
    while (index < end) {
      processor(items[index], index)
      index++
    }

    if (index < items.length && isRunning) {
      setTimeout(processChunk, delay)
    }
  }

  return {
    start: () => {
      isRunning = true
      processChunk()
    },
    stop: () => {
      isRunning = false
    },
    get progress() {
      return index / items.length
    },
    get isProcessing() {
      return isRunning
    }
  }
}

export const useVirtualScroll = (
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  buffer: number = 5
) => {
  const scrollTop = ref(0)

  const visibleCount = computed(() => Math.ceil(containerHeight / itemHeight) + buffer * 2)
  const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / itemHeight) - buffer))
  const endIndex = computed(() => Math.min(totalItems, startIndex.value + visibleCount.value))
  const offsetY = computed(() => startIndex.value * itemHeight)
  const totalHeight = computed(() => totalItems * itemHeight)

  const onScroll = (e: Event) => {
    scrollTop.value = (e.target as HTMLElement).scrollTop
  }

  return {
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    onScroll
  }
}

export const preloadImages = (urls: string[]): Promise<HTMLImageElement[]> => {
  return Promise.all(
    urls.map((url) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    })
  )
}

export const getImageSize = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export const dataURLToBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export const uuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
