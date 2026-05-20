import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';

export interface ColorAdjustParams {
  hue?: number;
  saturation?: number;
  brightness?: number;
  contrast?: number;
}

export interface StyleFilterParams {
  filterType: 'traditional' | 'modern' | 'ink' | 'gold' | 'woodblock' | 'embroidery' | 'batik';
  intensity?: number;
}

export class ImageProcessingService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(config.uploads.path, 'processed');
  }

  private ensureDir() {
    const fs = require('fs');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async adjustColor(imagePath: string, params: ColorAdjustParams): Promise<string> {
    this.ensureDir();

    try {
      let image = sharp(imagePath);

      if (params.hue !== undefined || params.saturation !== undefined) {
        image = image.modulate({
          hue: params.hue,
          saturation: params.saturation !== undefined ? 1 + params.saturation / 100 : undefined,
        });
      }

      if (params.brightness !== undefined || params.contrast !== undefined) {
        const brightness = params.brightness !== undefined ? 1 + params.brightness / 100 : 1;
        const contrast = params.contrast !== undefined ? 1 + params.contrast / 100 : 1;
        image = image.linear(brightness, brightness === 1 ? 0 : (1 - contrast) * 128);
      }

      const outputPath = path.join(this.tempDir, `color_adjusted_${uuidv4()}.png`);
      await image.png({ quality: 95 }).toFile(outputPath);

      logger.info(`Color adjustment completed: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Color adjustment failed:', error);
      throw new Error('色彩调整失败');
    }
  }

  async applyStyleFilter(imagePath: string, params: StyleFilterParams): Promise<string> {
    this.ensureDir();

    try {
      let image = sharp(imagePath);
      const intensity = params.intensity || 50;

      switch (params.filterType) {
        case 'traditional':
          image = await this.applyTraditionalStyle(image, intensity);
          break;
        case 'modern':
          image = await this.applyModernStyle(image, intensity);
          break;
        case 'ink':
          image = await this.applyInkStyle(image, intensity);
          break;
        case 'gold':
          image = await this.applyGoldStyle(image, intensity);
          break;
        case 'woodblock':
          image = await this.applyWoodblockStyle(image, intensity);
          break;
        case 'embroidery':
          image = await this.applyEmbroideryStyle(image, intensity);
          break;
        case 'batik':
          image = await this.applyBatikStyle(image, intensity);
          break;
        default:
          break;
      }

      const outputPath = path.join(this.tempDir, `styled_${params.filterType}_${uuidv4()}.png`);
      await image.png({ quality: 95 }).toFile(outputPath);

      logger.info(`Style filter applied: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Style filter application failed:', error);
      throw new Error('风格转换失败');
    }
  }

  private async applyTraditionalStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const factor = intensity / 100;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const sepiaR = Math.min(255, r * (0.393 + 0.607 * (1 - factor)) + g * 0.769 + b * 0.189);
      const sepiaG = Math.min(255, r * 0.349 + g * (0.686 + 0.314 * (1 - factor)) + b * 0.168);
      const sepiaB = Math.min(255, r * 0.272 + g * 0.534 + b * (0.131 + 0.869 * (1 - factor)));

      data[i] = Math.round(r * (1 - factor) + sepiaR * factor);
      data[i + 1] = Math.round(g * (1 - factor) + sepiaG * factor);
      data[i + 2] = Math.round(b * (1 - factor) + sepiaB * factor);
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }

  private async applyModernStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const factor = intensity / 100;
    return image.modulate({
      saturation: 1 + 0.3 * factor,
      brightness: 1 + 0.1 * factor,
    });
  }

  private async applyInkStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const factor = intensity / 100;
    const { data, info } = await image.grayscale().raw().toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += info.channels) {
      const value = data[i];
      const threshold = 128;
      const inkValue = value < threshold ? value * (1 - factor) : 255 - (255 - value) * (1 - factor);
      data[i] = Math.round(inkValue);
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .sharpen({ sigma: 0.8 });
  }

  private async applyGoldStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const factor = intensity / 100;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;

      const goldR = Math.min(255, brightness * 1.2 + 50);
      const goldG = Math.min(255, brightness * 1.0 + 30);
      const goldB = Math.min(255, brightness * 0.4);

      data[i] = Math.round(r * (1 - factor) + goldR * factor);
      data[i + 1] = Math.round(g * (1 - factor) + goldG * factor);
      data[i + 2] = Math.round(b * (1 - factor) + goldB * factor);
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }

  private async applyWoodblockStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const factor = intensity / 100;
    return image
      .modulate({ saturation: 1 - 0.4 * factor })
      .sharpen({ sigma: 0.5 + 0.5 * factor });
  }

  private async applyEmbroideryStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const factor = intensity / 100;
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const stitchSize = 4;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if ((x % stitchSize === 0 || y % stitchSize === 0) && Math.random() < 0.3 * factor) {
          const idx = (y * info.width + x) * info.channels;
          for (let c = 0; c < 3; c++) {
            data[idx + c] = Math.max(0, Math.min(255, data[idx + c] - 40));
          }
        }
      }
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }

  private async applyBatikStyle(image: sharp.Sharp, intensity: number): Promise<sharp.Sharp> {
    const factor = intensity / 100;
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const levels = 6;
    for (let i = 0; i < data.length; i += info.channels) {
      for (let c = 0; c < 3; c++) {
        const value = data[i + c];
        const level = Math.floor(value / (256 / levels)) * (256 / levels);
        data[i + c] = Math.round(value * (1 - factor) + level * factor);
      }
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }

  async extractFeatureVector(imagePath: string): Promise<number[]> {
    try {
      const image = sharp(imagePath).resize(128, 128, { fit: 'cover' });
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

      const features: number[] = [];

      const colorHist = this.extractColorHistogram(data, info.channels);
      features.push(...colorHist);

      const texture = await this.extractTextureFeatures(imagePath);
      features.push(...Object.values(texture));

      const shape = this.extractShapeFeatures(data, info.width, info.height, info.channels);
      features.push(...shape);

      return features.map(f => Math.round(f * 10000) / 10000);
    } catch (error) {
      logger.error('Feature vector extraction failed:', error);
      throw new Error('特征向量提取失败');
    }
  }

  private extractColorHistogram(data: Uint8Array, channels: number): number[] {
    const bins = 16;
    const histogram: number[] = new Array(bins * 3).fill(0);
    const totalPixels = data.length / channels;

    for (let i = 0; i < data.length; i += channels) {
      for (let c = 0; c < 3; c++) {
        const bin = Math.floor(data[i + c] / (256 / bins));
        histogram[c * bins + bin]++;
      }
    }

    return histogram.map(h => h / totalPixels);
  }

  private async extractTextureFeatures(imagePath: string): Promise<number[]> {
    const { data, info } = await sharp(imagePath).grayscale().resize(64, 64).raw().toBuffer({ resolveWithObject: true });

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const mean = sum / data.length;

    let variance = 0;
    for (let i = 0; i < data.length; i++) {
      variance += Math.pow(data[i] - mean, 2);
    }
    variance /= data.length;

    let edgeDensity = 0;
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const idx = y * info.width + x;
        const gx = data[idx + 1] - data[idx - 1];
        const gy = data[idx + info.width] - data[idx - info.width];
        if (Math.sqrt(gx * gx + gy * gy) > 20) {
          edgeDensity++;
        }
      }
    }
    edgeDensity /= data.length;

    return [mean / 255, variance / (255 * 255), edgeDensity];
  }

  private extractShapeFeatures(data: Uint8Array, width: number, height: number, channels: number): number[] {
    let centerX = 0, centerY = 0, total = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (brightness < 200) {
          centerX += x;
          centerY += y;
          total++;
        }
      }
    }

    if (total === 0) return [0.5, 0.5, 0];

    centerX /= total * width;
    centerY /= total * height;
    const coverage = total / (width * height);

    return [centerX, centerY, coverage];
  }

  calculateSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('特征向量长度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += Math.pow(vec1[i], 2);
      norm2 += Math.pow(vec2[i], 2);
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;

    const cosine = dotProduct / (norm1 * norm2);
    return Math.max(0, Math.min(1, cosine));
  }
}
