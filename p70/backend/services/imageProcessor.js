const sharp = require('sharp');
const fs = require('fs');

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

async function extractColors(imagePath, maxColors = 12) {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image
      .resize(150, 150, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelCount = info.width * info.height;
    const colorCounts = new Map();

    for (let i = 0; i < data.length; i += 3) {
      const r = Math.round(data[i] / 16) * 16;
      const g = Math.round(data[i + 1] / 16) * 16;
      const b = Math.round(data[i + 2] / 16) * 16;
      
      const key = `${r},${g},${b}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors);

    return sortedColors.map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number);
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        percentage: parseFloat((count / pixelCount * 100).toFixed(2))
      };
    });
  } catch (error) {
    console.error('提取颜色错误:', error);
    return [];
  }
}

function calculateHistogram(data, bins = 64, channels = 1) {
  const histograms = [];
  
  for (let c = 0; c < channels; c++) {
    const histogram = new Array(bins).fill(0);
    const binSize = 256 / bins;
    
    for (let i = c; i < data.length; i += channels) {
      const bin = Math.min(Math.floor(data[i] / binSize), bins - 1);
      histogram[bin]++;
    }
    
    const total = data.length / channels;
    histograms.push(...histogram.map(v => v / total));
  }
  
  return histograms;
}

function calculateEdgeFeatures(data, width, height) {
  const edges = [];
  const threshold = 30;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x);
      const gx = data[(y * width + x + 1)] - data[(y * width + x - 1)];
      const gy = data[((y + 1) * width + x)] - data[((y - 1) * width + x)];
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges.push(magnitude > threshold ? 1 : 0);
    }
  }
  
  const edgeDensity = edges.filter(v => v === 1).length / edges.length;
  
  return {
    density: edgeDensity,
    histogram: calculateHistogram(Uint8Array.from(edges.map(v => v * 255)), 16)
  };
}

function calculateColorMoments(data) {
  const moments = [];
  const channels = [[], [], []];
  
  for (let i = 0; i < data.length; i += 3) {
    channels[0].push(data[i]);
    channels[1].push(data[i + 1]);
    channels[2].push(data[i + 2]);
  }
  
  for (const channel of channels) {
    const mean = channel.reduce((a, b) => a + b, 0) / channel.length;
    const variance = Math.sqrt(channel.reduce((a, b) => a + (b - mean) ** 2, 0) / channel.length);
    const skewness = Math.cbrt(channel.reduce((a, b) => a + (b - mean) ** 3, 0) / channel.length);
    
    moments.push(mean / 255, variance / 255, (skewness + 128) / 256);
  }
  
  return moments;
}

function calculateHOGFeatures(data, width, height, cellSize = 8, bins = 9) {
  const gradients = [];
  const cellGradients = new Array(bins).fill(0);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = data[idx + 1] - data[idx - 1];
      const gy = data[idx + width] - data[idx - width];
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const angle = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
      const bin = Math.floor(angle / (180 / bins));
      
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const cellIdx = cellY * Math.floor(width / cellSize) + cellX;
      
      if (!gradients[cellIdx]) gradients[cellIdx] = new Array(bins).fill(0);
      gradients[cellIdx][bin] += magnitude;
    }
  }
  
  const normalized = gradients.flat().filter(v => !isNaN(v));
  const maxVal = Math.max(...normalized, 1);
  return normalized.map(v => v / maxVal).slice(0, 100);
}

async function extractFeatures(imagePath) {
  try {
    const image = sharp(imagePath);
    
    const processedImage = image
      .resize(128, 128, { fit: 'cover' })
      .normalize();
    
    const grayBuffer = await processedImage
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const colorBuffer = await processedImage
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const grayHistogram = calculateHistogram(grayBuffer.data, 64, 1);
    
    const rgbHistogram = calculateHistogram(colorBuffer.data, 32, 3);
    
    const edgeFeatures = calculateEdgeFeatures(
      grayBuffer.data,
      grayBuffer.info.width,
      grayBuffer.info.height
    );
    
    const colorMoments = calculateColorMoments(colorBuffer.data);
    
    const hogFeatures = calculateHOGFeatures(
      grayBuffer.data,
      grayBuffer.info.width,
      grayBuffer.info.height
    );
    
    const featureVector = [
      ...grayHistogram.map(v => v * 2),
      ...rgbHistogram.map(v => v * 1.5),
      ...edgeFeatures.histogram.map(v => v * 3),
      ...colorMoments.map(v => v * 2),
      ...(hogFeatures.length > 0 ? hogFeatures.slice(0, 50).map(v => v * 1.5) : new Array(50).fill(0))
    ];
    
    const normalizedVector = normalizeVector(featureVector);
    
    const metadata = await image.metadata();
    
    return {
      vector: normalizedVector,
      grayHistogram,
      rgbHistogram,
      edgeFeatures: {
        density: edgeFeatures.density,
        histogram: edgeFeatures.histogram
      },
      colorMoments,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      aspectRatio: metadata.width / metadata.height,
      channels: metadata.channels,
      format: metadata.format
    };
  } catch (error) {
    console.error('提取特征错误:', error);
    return {
      vector: [],
      grayHistogram: [],
      rgbHistogram: [],
      edgeFeatures: { density: 0, histogram: [] },
      colorMoments: [],
      dimensions: { width: 0, height: 0 }
    };
  }
}

function normalizeVector(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
}

function calculateWeightedSimilarity(vec1, vec2, weights = null) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length || vec1.length === 0) {
    return 0;
  }
  
  const featureLengths = {
    grayHist: 64,
    rgbHist: 96,
    edgeHist: 16,
    colorMoments: 9,
    hog: 50
  };
  
  const defaultWeights = {
    grayHist: 1.5,
    rgbHist: 2.0,
    edgeHist: 2.5,
    colorMoments: 1.0,
    hog: 1.8
  };
  
  const w = weights || defaultWeights;
  
  let offset = 0;
  let totalWeightedSimilarity = 0;
  let totalWeight = 0;
  
  const featureSections = [
    { name: 'grayHist', length: featureLengths.grayHist, weight: w.grayHist },
    { name: 'rgbHist', length: featureLengths.rgbHist, weight: w.rgbHist },
    { name: 'edgeHist', length: featureLengths.edgeHist, weight: w.edgeHist },
    { name: 'colorMoments', length: featureLengths.colorMoments, weight: w.colorMoments },
    { name: 'hog', length: featureLengths.hog, weight: w.hog }
  ];
  
  for (const section of featureSections) {
    if (offset + section.length > vec1.length) break;
    
    const subVec1 = vec1.slice(offset, offset + section.length);
    const subVec2 = vec2.slice(offset, offset + section.length);
    
    const sim = calculateCosineSimilarity(subVec1, subVec2);
    totalWeightedSimilarity += sim * section.weight;
    totalWeight += section.weight;
    
    offset += section.length;
  }
  
  return totalWeight > 0 ? totalWeightedSimilarity / totalWeight : 0;
}

function calculateCosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function calculateSimilarity(vec1, vec2) {
  return calculateWeightedSimilarity(vec1, vec2);
}

function calculateColorSimilarity(colors1, colors2) {
  if (!colors1 || !colors2 || colors1.length === 0 || colors2.length === 0) {
    return 0;
  }
  
  let similarity = 0;
  const maxCompare = Math.min(colors1.length, colors2.length, 5);
  
  for (let i = 0; i < maxCompare; i++) {
    const c1 = colors1[i];
    const c2 = colors2[i];
    
    const colorDist = Math.sqrt(
      Math.pow(c1.rgb.r - c2.rgb.r, 2) +
      Math.pow(c1.rgb.g - c2.rgb.g, 2) +
      Math.pow(c1.rgb.b - c2.rgb.b, 2)
    ) / Math.sqrt(255 * 255 * 3);
    
    const percentSim = 1 - Math.abs(c1.percentage - c2.percentage) / 100;
    
    similarity += (1 - colorDist) * percentSim;
  }
  
  return similarity / maxCompare;
}

function classifyPattern(colors, features) {
  const categories = ['生角', '旦角', '净角', '末角', '丑角'];
  
  if (!colors || colors.length === 0) return '未分类';
  
  const redScore = colors.reduce((score, c) => {
    if (c.rgb.r > 150 && c.rgb.g < 120 && c.rgb.b < 120) {
      return score + c.percentage;
    }
    return score;
  }, 0);
  
  const blackScore = colors.reduce((score, c) => {
    if (c.rgb.r < 80 && c.rgb.g < 80 && c.rgb.b < 80) {
      return score + c.percentage;
    }
    return score;
  }, 0);
  
  const whiteScore = colors.reduce((score, c) => {
    if (c.rgb.r > 200 && c.rgb.g > 200 && c.rgb.b > 200) {
      return score + c.percentage;
    }
    return score;
  }, 0);
  
  const goldScore = colors.reduce((score, c) => {
    if (c.rgb.r > 180 && c.rgb.g > 150 && c.rgb.b < 100) {
      return score + c.percentage;
    }
    return score;
  }, 0);
  
  const edgeDensity = features?.edgeFeatures?.density || 0;
  
  if (redScore > 25) return '净角';
  if (goldScore > 15 && edgeDensity > 0.3) return '丑角';
  if (whiteScore > blackScore && whiteScore > 30) return '旦角';
  if (blackScore > 35 && edgeDensity > 0.25) return '净角';
  if (blackScore > 20 && blackScore < 35) return '生角';
  if (whiteScore > 20 && whiteScore < 30) return '末角';
  
  return '未分类';
}

module.exports = {
  extractColors,
  extractFeatures,
  calculateSimilarity,
  calculateColorSimilarity,
  calculateWeightedSimilarity,
  calculateCosineSimilarity,
  classifyPattern,
  rgbToHex,
  hexToRgb,
  normalizeVector
};
