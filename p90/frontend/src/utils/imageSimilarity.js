function extractColorHistogram(imageData, bins = 16) {
  const { data, width, height } = imageData
  const histogram = {
    r: new Array(bins).fill(0),
    g: new Array(bins).fill(0),
    b: new Array(bins).fill(0)
  }
  
  const pixels = width * height
  const binSize = 256 / bins
  
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.floor(data[i] / binSize)
    const g = Math.floor(data[i + 1] / binSize)
    const b = Math.floor(data[i + 2] / binSize)
    
    histogram.r[r]++
    histogram.g[g]++
    histogram.b[b]++
  }
  
  for (let i = 0; i < bins; i++) {
    histogram.r[i] /= pixels
    histogram.g[i] /= pixels
    histogram.b[i] /= pixels
  }
  
  return histogram
}

function calculateHistogramSimilarity(hist1, hist2) {
  let similarity = 0
  const bins = hist1.r.length
  
  for (let i = 0; i < bins; i++) {
    similarity += Math.min(hist1.r[i], hist2.r[i])
    similarity += Math.min(hist1.g[i], hist2.g[i])
    similarity += Math.min(hist1.b[i], hist2.b[i])
  }
  
  return similarity / 3
}

function extractAverageColor(imageData) {
  const { data } = imageData
  let r = 0, g = 0, b = 0
  const pixels = data.length / 4
  
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  
  return {
    r: Math.round(r / pixels),
    g: Math.round(g / pixels),
    b: Math.round(b / pixels)
  }
}

function colorDistance(c1, c2) {
  const dr = c1.r - c2.r
  const dg = c1.g - c2.g
  const db = c1.b - c2.b
  return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255)
}

function extractColorFeatures(imageData) {
  const histogram = extractColorHistogram(imageData)
  const avgColor = extractAverageColor(imageData)
  
  const dominantColors = []
  const binSize = 16
  for (let i = 0; i < 16; i++) {
    if (histogram.r[i] > 0.05 || histogram.g[i] > 0.05 || histogram.b[i] > 0.05) {
      dominantColors.push({
        r: Math.round((i + 0.5) * binSize),
        g: Math.round((i + 0.5) * binSize),
        b: Math.round((i + 0.5) * binSize),
        weight: (histogram.r[i] + histogram.g[i] + histogram.b[i]) / 3
      })
    }
  }
  
  return {
    histogram,
    avgColor,
    dominantColors: dominantColors.slice(0, 5)
  }
}

function calculateSimilarity(features1, features2) {
  const histogramSim = calculateHistogramSimilarity(features1.histogram, features2.histogram)
  const avgColorSim = 1 - colorDistance(features1.avgColor, features2.avgColor)
  
  let dominantColorSim = 0
  const maxCompare = Math.min(features1.dominantColors.length, features2.dominantColors.length)
  if (maxCompare > 0) {
    for (let i = 0; i < maxCompare; i++) {
      const dist = colorDistance(features1.dominantColors[i], features2.dominantColors[i])
      dominantColorSim += (1 - dist) * features1.dominantColors[i].weight
    }
    dominantColorSim /= maxCompare
  } else {
    dominantColorSim = avgColorSim
  }
  
  return (histogramSim * 0.5 + avgColorSim * 0.3 + dominantColorSim * 0.2)
}

async function getImageDataFromUrl(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 100
      canvas.height = 100
      ctx.drawImage(img, 0, 0, 100, 100)
      resolve(ctx.getImageData(0, 0, 100, 100))
    }
    img.onerror = reject
    img.src = imageUrl
  })
}

export async function extractPatternFeatures(imageUrl) {
  try {
    const imageData = await getImageDataFromUrl(imageUrl)
    return extractColorFeatures(imageData)
  } catch (error) {
    console.error('提取特征失败:', error)
    return null
  }
}

export async function searchSimilarPatterns(targetPattern, allPatterns, threshold = 0.6) {
  if (!targetPattern.features) {
    targetPattern.features = await extractPatternFeatures(targetPattern.imageData)
  }
  
  const results = []
  
  for (const pattern of allPatterns) {
    if (pattern.id === targetPattern.id) continue
    
    if (!pattern.features) {
      pattern.features = await extractPatternFeatures(pattern.imageData)
    }
    
    if (pattern.features && targetPattern.features) {
      const similarity = calculateSimilarity(targetPattern.features, pattern.features)
      if (similarity >= threshold) {
        results.push({
          ...pattern,
          similarity,
          similarityPercent: Math.round(similarity * 100)
        })
      }
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity)
}

export function findSimilarByColor(targetColor, allPatterns, threshold = 0.5) {
  const results = []
  
  for (const pattern of allPatterns) {
    if (pattern.features) {
      const colorSim = 1 - colorDistance(targetColor, pattern.features.avgColor)
      if (colorSim >= threshold) {
        results.push({
          ...pattern,
          similarity: colorSim,
          similarityPercent: Math.round(colorSim * 100)
        })
      }
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity)
}

export function getSimilarityColorClass(similarity) {
  if (similarity >= 0.8) return 'high'
  if (similarity >= 0.6) return 'medium'
  return 'low'
}

export default {
  extractPatternFeatures,
  searchSimilarPatterns,
  findSimilarByColor,
  getSimilarityColorClass
}
