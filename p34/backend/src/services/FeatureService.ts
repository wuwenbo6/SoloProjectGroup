import sharp from 'sharp';
import { FeatureRepository } from '../repositories/FeatureRepository';
import { MaterialRepository } from '../repositories/MaterialRepository';
import prisma from '../config/database';
import logger from '../utils/logger';
import { ExtractFeatureRequest } from '../types';

interface CachedFeature {
  colorPalette: string[];
  textureFeatures: Record<string, number>;
  contour: number[][];
  timestamp: number;
}

export class FeatureService {
  private featureRepository: FeatureRepository;
  private materialRepository: MaterialRepository;
  private featureCache: Map<string, CachedFeature>;
  private readonly CACHE_TTL = 3600000;

  constructor() {
    this.featureRepository = new FeatureRepository();
    this.materialRepository = new MaterialRepository();
    this.featureCache = new Map();
  }

  private async preprocessImage(imagePath: string): Promise<sharp.Sharp> {
    try {
      return sharp(imagePath)
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3
        })
        .sharpen({ sigma: 1.0, flat: 0.5, jagged: 1.5 })
        .normalize()
        .modulate({ saturation: 1.1 });
    } catch (error) {
      logger.error('Image preprocessing failed:', error);
      return sharp(imagePath);
    }
  }

  private async createImagePyramid(imagePath: string): Promise<{ data: Uint8Array; info: sharp.OutputInfo; scale: number }[]> {
    const scales = [1.0, 0.5, 0.25];
    const pyramid = [];
    
    for (const scale of scales) {
      const size = Math.floor(1024 * scale);
      const processed = await sharp(imagePath)
        .resize(size, size, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      pyramid.push({ ...processed, scale });
    }
    
    return pyramid;
  }

  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, v };
  }

  private colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const rmean = (r1 + r2) / 2;
    const r = r1 - r2;
    const g = g1 - g2;
    const b = b1 - b2;
    return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
  }

  private kMeansColors(colors: number[][], k: number = 12, maxIterations: number = 20): number[][] {
    if (colors.length <= k) return colors;
    
    let centroids = colors.slice(0, k);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      const clusters: number[][][] = Array.from({ length: k }, () => []);
      
      for (const color of colors) {
        let minDist = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < centroids.length; i++) {
          const dist = this.colorDistance(color[0], color[1], color[2], centroids[i][0], centroids[i][1], centroids[i][2]);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        clusters[closestIdx].push(color);
      }
      
      let changed = false;
      for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
          const newCentroid = [
            Math.round(clusters[i].reduce((s, c) => s + c[0], 0) / clusters[i].length),
            Math.round(clusters[i].reduce((s, c) => s + c[1], 0) / clusters[i].length),
            Math.round(clusters[i].reduce((s, c) => s + c[2], 0) / clusters[i].length)
          ];
          if (this.colorDistance(newCentroid[0], newCentroid[1], newCentroid[2], centroids[i][0], centroids[i][1], centroids[i][2]) > 5) {
            changed = true;
          }
          centroids[i] = newCentroid;
        }
      }
      
      if (!changed) break;
    }
    
    return centroids;
  }

  private async extractColorPalette(imagePath: string): Promise<string[]> {
    try {
      const cacheKey = `colors_${imagePath}`;
      const cached = this.featureCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.colorPalette;
      }

      const processedImage = await this.preprocessImage(imagePath);
      const { data, info } = await processedImage.raw().toBuffer({ resolveWithObject: true });
      
      const pixelCount = info.width * info.height;
      const sampleColors: number[][] = [];
      const sampleStep = Math.max(1, Math.floor(pixelCount / 50000));
      
      const channels = info.channels;
      const colorWeight = new Map<string, { color: number[]; weight: number }>();
      
      for (let i = 0; i < pixelCount; i += sampleStep) {
        const idx = i * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        if (channels === 4 && data[idx + 3] < 64) continue;
        
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness < 20 || brightness > 240) continue;
        
        const key = `${Math.round(r/16)}_${Math.round(g/16)}_${Math.round(b/16)}`;
        const existing = colorWeight.get(key);
        
        if (existing) {
          existing.weight++;
        } else {
          colorWeight.set(key, { color: [r, g, b], weight: 1 });
          sampleColors.push([r, g, b]);
        }
      }

      const weightedColors = Array.from(colorWeight.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 200)
        .map(cw => cw.color);

      const dominantColors = this.kMeansColors(weightedColors, 12);
      
      const sortedColors = dominantColors
        .map(c => {
          const hsv = this.rgbToHsv(c[0], c[1], c[2]);
          return { color: c, hsv };
        })
        .sort((a, b) => a.hsv.h - b.hsv.h || a.hsv.s - b.hsv.s)
        .map(item => `#${item.color[0].toString(16).padStart(2, '0')}${item.color[1].toString(16).padStart(2, '0')}${item.color[2].toString(16).padStart(2, '0')}`);

      this.featureCache.set(cacheKey, { 
        colorPalette: sortedColors, 
        textureFeatures: {}, 
        contour: [],
        timestamp: Date.now() 
      });

      return sortedColors;
    } catch (error) {
      logger.error('Color palette extraction failed:', error);
      return ['#000000', '#FFFFFF', '#8B4513', '#D4AF37', '#654321', '#800000'];
    }
  }

  private calculateGLCM(data: Uint8Array, width: number, height: number, angle: number = 0): number[][] {
    const levels = 16;
    const glcm: number[][] = Array.from({ length: levels }, () => Array(levels).fill(0));
    
    const dx = angle === 0 ? 1 : 0;
    const dy = angle === 0 ? 0 : 1;
    
    for (let y = 0; y < height - dy; y++) {
      for (let x = 0; x < width - dx; x++) {
        const i = Math.floor(data[y * width + x] / 16);
        const j = Math.floor(data[(y + dy) * width + (x + dx)] / 16);
        glcm[i][j]++;
      }
    }
    
    return glcm;
  }

  private calculateGLCMFeatures(glcm: number[][]): { contrast: number; homogeneity: number; energy: number; correlation: number } {
    let total = 0;
    for (let i = 0; i < glcm.length; i++) {
      for (let j = 0; j < glcm[i].length; j++) {
        total += glcm[i][j];
      }
    }
    
    if (total === 0) return { contrast: 0, homogeneity: 0, energy: 0, correlation: 0 };
    
    let contrast = 0, homogeneity = 0, energy = 0;
    let meanI = 0, meanJ = 0, varI = 0, varJ = 0, cov = 0;
    
    for (let i = 0; i < glcm.length; i++) {
      for (let j = 0; j < glcm[i].length; j++) {
        const p = glcm[i][j] / total;
        contrast += p * Math.pow(i - j, 2);
        homogeneity += p / (1 + Math.abs(i - j));
        energy += p * p;
        meanI += i * p;
        meanJ += j * p;
      }
    }
    
    for (let i = 0; i < glcm.length; i++) {
      for (let j = 0; j < glcm[i].length; j++) {
        const p = glcm[i][j] / total;
        varI += p * Math.pow(i - meanI, 2);
        varJ += p * Math.pow(j - meanJ, 2);
        cov += p * (i - meanI) * (j - meanJ);
      }
    }
    
    const correlation = (varI > 0 && varJ > 0) ? cov / Math.sqrt(varI * varJ) : 0;
    
    return { contrast, homogeneity, energy, correlation };
  }

  private calculateSobelEdges(data: Uint8Array, width: number, height: number): { edges: number[][]; magnitude: Float32Array; direction: Float32Array } {
    const edges: number[][] = [];
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    const gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const threshold = 30;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sumX = 0, sumY = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = data[(y + ky) * width + (x + kx)];
            sumX += pixel * gx[ky + 1][kx + 1];
            sumY += pixel * gy[ky + 1][kx + 1];
          }
        }
        const mag = Math.sqrt(sumX * sumX + sumY * sumY);
        const dir = Math.atan2(sumY, sumX);
        
        magnitude[y * width + x] = mag;
        direction[y * width + x] = dir;
        
        if (mag > threshold) {
          edges.push([x, y]);
        }
      }
    }
    
    return { edges, magnitude, direction };
  }

  private nonMaximumSuppression(magnitude: Float32Array, direction: Float32Array, width: number, height: number): Uint8Array {
    const suppressed = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const mag = magnitude[idx];
        const dir = direction[idx];
        
        let neighbor1 = 0, neighbor2 = 0;
        const angle = (dir >= 0 ? dir : dir + Math.PI) / Math.PI * 180;
        
        if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
          neighbor1 = magnitude[y * width + (x - 1)];
          neighbor2 = magnitude[y * width + (x + 1)];
        } else if (angle >= 22.5 && angle < 67.5) {
          neighbor1 = magnitude[(y - 1) * width + (x + 1)];
          neighbor2 = magnitude[(y + 1) * width + (x - 1)];
        } else if (angle >= 67.5 && angle < 112.5) {
          neighbor1 = magnitude[(y - 1) * width + x];
          neighbor2 = magnitude[(y + 1) * width + x];
        } else {
          neighbor1 = magnitude[(y - 1) * width + (x - 1)];
          neighbor2 = magnitude[(y + 1) * width + (x + 1)];
        }
        
        if (mag >= neighbor1 && mag >= neighbor2) {
          suppressed[idx] = mag > 50 ? 255 : 0;
        }
      }
    }
    
    return suppressed;
  }

  private async extractTextureFeatures(imagePath: string): Promise<Record<string, number>> {
    try {
      const cacheKey = `texture_${imagePath}`;
      const cached = this.featureCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.textureFeatures;
      }

      const processedImage = await this.preprocessImage(imagePath);
      const { data, info } = await processedImage.grayscale().raw().toBuffer({ resolveWithObject: true });
      
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const brightness = sum / data.length;
      
      let variance = 0;
      for (let i = 0; i < data.length; i++) {
        variance += Math.pow(data[i] - brightness, 2);
      }
      const contrast = variance / data.length;
      
      const { edges, magnitude, direction } = this.calculateSobelEdges(data, info.width, info.height);
      const edgeDensity = edges.length / (info.width * info.height);
      const edgeStrength = magnitude.reduce((a, b) => a + b, 0) / magnitude.length;
      
      const thinEdges = this.nonMaximumSuppression(magnitude, direction, info.width, info.height);
      let thinEdgeCount = 0;
      for (let i = 0; i < thinEdges.length; i++) {
        if (thinEdges[i] > 0) thinEdgeCount++;
      }
      const edgeThinness = thinEdgeCount / Math.max(1, edges.length);
      
      let entropy = 0;
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i++) {
        histogram[data[i]]++;
      }
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) {
          const p = histogram[i] / data.length;
          entropy -= p * Math.log2(p);
        }
      }
      
      const glcm = this.calculateGLCM(data, info.width, info.height);
      const glcmFeatures = this.calculateGLCMFeatures(glcm);
      
      const textureFeatures = {
        brightness: brightness / 255,
        contrast: Math.min(1, contrast / (255 * 255) * 10),
        complexity: Math.min(1, edgeDensity * 100),
        edgeDensity,
        edgeStrength: edgeStrength / 255,
        edgeThinness,
        entropy: entropy / 8,
        glcmContrast: Math.min(1, glcmFeatures.contrast / 100),
        glcmHomogeneity: glcmFeatures.homogeneity,
        glcmEnergy: glcmFeatures.energy,
        glcmCorrelation: (glcmFeatures.correlation + 1) / 2
      };

      this.featureCache.set(cacheKey, { 
        colorPalette: [], 
        textureFeatures, 
        contour: [],
        timestamp: Date.now() 
      });

      return textureFeatures;
    } catch (error) {
      logger.error('Texture feature extraction failed:', error);
      return { 
        brightness: 0.5, 
        contrast: 0.5, 
        complexity: 0.5, 
        edgeDensity: 0.1, 
        edgeStrength: 0.3,
        edgeThinness: 0.5,
        entropy: 0.5,
        glcmContrast: 0.5,
        glcmHomogeneity: 0.5,
        glcmEnergy: 0.5,
        glcmCorrelation: 0.5
      };
    }
  }

  private async extractContour(imagePath: string): Promise<number[][]> {
    try {
      const pyramid = await this.createImagePyramid(imagePath);
      let bestContour: number[][] = [];
      
      for (const level of pyramid) {
        const { data, info, scale } = level;
        
        const grayData = new Uint8Array(info.width * info.height);
        for (let i = 0; i < data.length; i += 3) {
          grayData[i / 3] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        
        const { edges } = this.calculateSobelEdges(grayData, info.width, info.height);
        
        if (edges.length > 50) {
          const sampled = edges.length > 200 ? edges.filter((_, i) => i % Math.ceil(edges.length / 200) === 0) : edges;
          bestContour = sampled.map(p => [p[0] / scale, p[1] / scale]);
          break;
        }
      }
      
      if (bestContour.length === 0) {
        return this.generateDefaultContour();
      }
      
      return this.simplifyContour(bestContour, 100);
    } catch (error) {
      logger.error('Contour extraction failed:', error);
      return this.generateDefaultContour();
    }
  }

  private simplifyContour(contour: number[][], targetPoints: number): number[][] {
    if (contour.length <= targetPoints) return contour;
    
    const simplified = [contour[0]];
    const step = Math.floor(contour.length / targetPoints);
    
    for (let i = step; i < contour.length; i += step) {
      simplified.push(contour[i]);
    }
    
    return simplified;
  }

  private extractGeometricParams(contour: number[][]): { 
    aspectRatio: number; 
    complexity: number; 
    symmetry: number;
    density: number;
    regularity: number;
    circularity: number;
    elongation: number;
  } {
    if (contour.length < 3) {
      return { 
        aspectRatio: 1, 
        complexity: 0.5, 
        symmetry: 0.5, 
        density: 0.5, 
        regularity: 0.5,
        circularity: 0.5,
        elongation: 0.5
      };
    }

    const xs = contour.map(p => p[0]);
    const ys = contour.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width > 0 && height > 0 ? Math.min(width / height, height / width) : 1;
    const elongation = width > 0 && height > 0 ? Math.abs(width - height) / Math.max(width, height) : 0;
    
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const next = (i + 1) % contour.length;
      const dx = contour[i][0] - contour[next][0];
      const dy = contour[i][1] - contour[next][1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    const area = width * height;
    const complexity = Math.min(1, perimeter / (2 * (width + height)));
    const circularity = area > 0 ? Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter)) : 0;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    let symmetricPoints = 0;
    for (const [x, y] of contour) {
      const mirrorX = 2 * centerX - x;
      const mirrorY = 2 * centerY - y;
      const hasMirror = contour.some(p => 
        Math.abs(p[0] - mirrorX) < 10 && Math.abs(p[1] - mirrorY) < 10
      );
      if (hasMirror) symmetricPoints++;
    }
    const symmetry = symmetricPoints / contour.length;
    
    let totalAngle = 0;
    for (let i = 0; i < contour.length; i++) {
      const prev = contour[(i - 1 + contour.length) % contour.length];
      const curr = contour[i];
      const next = contour[(i + 1) % contour.length];
      
      const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
      const v2 = [next[0] - curr[0], next[1] - curr[1]];
      
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
      
      if (mag1 > 0 && mag2 > 0) {
        totalAngle += Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
      }
    }
    const regularity = 1 - Math.abs(totalAngle - Math.PI * 2) / (Math.PI * 4);
    
    return { 
      aspectRatio, 
      complexity, 
      symmetry,
      density: Math.min(1, contour.length / Math.max(1, Math.sqrt(area)) * 2),
      regularity: Math.max(0, regularity),
      circularity,
      elongation
    };
  }

  private generateFeatureVector(colorPalette: string[], textureFeatures: Record<string, number>, geometricParams: Record<string, number>): number[] {
    const vector: number[] = [];
    
    for (let i = 0; i < 12; i++) {
      if (colorPalette[i]) {
        const color = colorPalette[i];
        vector.push(parseInt(color.slice(1, 3), 16) / 255);
        vector.push(parseInt(color.slice(3, 5), 16) / 255);
        vector.push(parseInt(color.slice(5, 7), 16) / 255);
      } else {
        vector.push(0, 0, 0);
      }
    }
    
    vector.push(...Object.values(textureFeatures));
    vector.push(...Object.values(geometricParams));
    
    return vector;
  }

  async extractFeatures(userId: string, request: ExtractFeatureRequest) {
    const startTime = Date.now();
    const material = await this.materialRepository.findById(request.materialId);
    if (!material) {
      throw new Error('素材不存在');
    }

    await this.materialRepository.update(request.materialId, { status: 'PROCESSING' });

    try {
      let contourData: number[][];
      
      if (request.manualContour && request.manualContour.length > 0) {
        contourData = request.manualContour;
      } else {
        contourData = await this.extractContour(material.imageUrl);
      }

      const [colorPalette, textureFeatures] = await Promise.all([
        this.extractColorPalette(material.imageUrl),
        this.extractTextureFeatures(material.imageUrl)
      ]);
      
      const geometricParams = this.extractGeometricParams(contourData);
      const featureVector = this.generateFeatureVector(colorPalette, textureFeatures, geometricParams);

      const existingFeature = await this.featureRepository.findByMaterial(request.materialId);
      
      let feature;
      const featureData = {
        contourData: JSON.stringify(contourData),
        colorPalette,
        textureFeatures,
        geometricParams,
        featureVector: JSON.stringify(featureVector),
        isManual: !!request.manualContour,
        extractionTime: Date.now() - startTime,
      };

      if (existingFeature) {
        feature = await this.featureRepository.update(existingFeature.id, featureData);
      } else {
        feature = await this.featureRepository.create({
          material: { connect: { id: request.materialId } },
          ...featureData,
          extractor: { connect: { id: userId } },
        });
      }

      await this.materialRepository.update(request.materialId, { 
        status: 'PROCESSED',
        featureQuality: this.calculateQualityScore(textureFeatures, geometricParams)
      });
      
      logger.info(`Features extracted for material: ${request.materialId} in ${Date.now() - startTime}ms`);

      return feature;
    } catch (error) {
      await this.materialRepository.update(request.materialId, { 
        status: 'ERROR', 
        errorMessage: error instanceof Error ? error.message : '特征提取失败' 
      });
      throw error;
    }
  }

  private calculateQualityScore(texture: Record<string, number>, geometry: Record<string, number>): number {
    const scores = [
      texture.complexity * 0.2,
      texture.edgeDensity * 0.15,
      texture.entropy * 0.15,
      geometry.symmetry * 0.2,
      geometry.circularity * 0.15,
      geometry.regularity * 0.15
    ];
    return scores.reduce((a, b) => a + b, 0);
  }

  private generateDefaultContour(): number[][] {
    const contour: number[][] = [];
    const points = 50;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 80 + Math.random() * 20;
      contour.push([150 + Math.cos(angle) * radius, 150 + Math.sin(angle) * radius]);
    }
    return contour;
  }

  async getFeatureByMaterial(materialId: string) {
    return this.featureRepository.findByMaterial(materialId);
  }

  async getFeaturesByUser(userId: string, page: number, pageSize: number) {
    return this.featureRepository.findByUser(userId, page, pageSize);
  }

  async getFeatures(page: number, pageSize: number) {
    return this.featureRepository.findPaginated(page, pageSize, {
      include: { material: true, extractor: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const total = await this.featureRepository.count();
    const manual = await this.featureRepository.count({ where: { isManual: true } });
    
    return { total, manual };
  }

  clearCache() {
    this.featureCache.clear();
    logger.info('Feature cache cleared');
  }
}
