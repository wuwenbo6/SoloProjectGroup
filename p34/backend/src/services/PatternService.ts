import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { PatternRepository } from '../repositories/PatternRepository';
import { FeatureRepository } from '../repositories/FeatureRepository';
import logger from '../utils/logger';
import { GeneratePatternRequest } from '../types';

export class PatternService {
  private patternRepository: PatternRepository;
  private featureRepository: FeatureRepository;

  constructor() {
    this.patternRepository = new PatternRepository();
    this.featureRepository = new FeatureRepository();
  }

  private createHexagonPath(cx: number, cy: number, radius: number): string {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return points.join(' ');
  }

  private createFloralPattern(cx: number, cy: number, size: number, colors: string[]): string {
    const petals = 6;
    let path = '';
    
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const petalLength = size * 0.4;
      const petalWidth = size * 0.15;
      
      const startX = cx + Math.cos(angle) * size * 0.15;
      const startY = cy + Math.sin(angle) * size * 0.15;
      const endX = cx + Math.cos(angle) * petalLength;
      const endY = cy + Math.sin(angle) * petalLength;
      
      const perpAngle = angle + Math.PI / 2;
      const cp1x = startX + Math.cos(perpAngle) * petalWidth;
      const cp1y = startY + Math.sin(perpAngle) * petalWidth;
      const cp2x = endX + Math.cos(perpAngle) * petalWidth * 0.5;
      const cp2y = endY + Math.sin(perpAngle) * petalWidth * 0.5;
      
      path += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;
      path += `Q ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)} `;
    }
    
    return path;
  }

  private createGeometricBorder(size: number, colors: string[]): string {
    const half = size / 2;
    const borderWidth = size * 0.1;
    let pattern = '';

    const corners = [
      [borderWidth, borderWidth],
      [size - borderWidth, borderWidth],
      [size - borderWidth, size - borderWidth],
      [borderWidth, size - borderWidth]
    ];

    corners.forEach(([x, y], i) => {
      const color = colors[i % colors.length];
      pattern += `<rect x="${x - borderWidth/2}" y="${y - borderWidth/2}" width="${borderWidth}" height="${borderWidth}" fill="${color}" />`;
    });

    pattern += `<line x1="${borderWidth}" y1="${half}" x2="${size - borderWidth}" y2="${half}" stroke="${colors[0]}" stroke-width="3" stroke-dasharray="8,4"/>`;
    pattern += `<line x1="${half}" y1="${borderWidth}" x2="${half}" y2="${size - borderWidth}" stroke="${colors[0]}" stroke-width="3" stroke-dasharray="8,4"/>`;

    return pattern;
  }

  private createRepeatingPattern(
    unitSize: number,
    repeatX: number,
    repeatY: number,
    spacing: number,
    colors: string[],
    patternType: string = 'floral',
    rotation: number = 0
  ): string {
    let svg = '';
    const totalWidth = unitSize * repeatX + spacing * (repeatX - 1);
    const totalHeight = unitSize * repeatY + spacing * (repeatY - 1);

    for (let y = 0; y < repeatY; y++) {
      for (let x = 0; x < repeatX; x++) {
        const cx = x * (unitSize + spacing) + unitSize / 2;
        const cy = y * (unitSize + spacing) + unitSize / 2;
        const cellRotation = rotation + (x + y) * 15;

        svg += `<g transform="rotate(${cellRotation}, ${cx}, ${cy})">`;

        switch (patternType) {
          case 'hexagon':
            svg += `<polygon points="${this.createHexagonPath(cx, cy, unitSize * 0.4)}" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="2"/>`;
            svg += `<polygon points="${this.createHexagonPath(cx, cy, unitSize * 0.25)}" fill="${colors[2] || colors[1]}" stroke="${colors[1]}" stroke-width="1.5"/>`;
            break;

          case 'geometric':
            svg += this.createGeometricBorder(unitSize, colors);
            svg += `<circle cx="${cx}" cy="${cy}" r="${unitSize * 0.15}" fill="${colors[1]}" />`;
            break;

          case 'stripe':
            for (let s = 0; s < 4; s++) {
              const offset = s * (unitSize / 4);
              svg += `<rect x="${cx - unitSize/2 + offset}" y="${cy - unitSize/2}" width="${unitSize/8}" height="${unitSize}" fill="${colors[s % colors.length]}" />`;
            }
            break;

          case 'floral':
          default:
            svg += `<circle cx="${cx}" cy="${cy}" r="${unitSize * 0.12}" fill="${colors[1]}" />`;
            svg += `<path d="${this.createFloralPattern(cx, cy, unitSize, colors)}" fill="none" stroke="${colors[0]}" stroke-width="1.5" stroke-linecap="round"/>`;
            
            for (let d = 0; d < 8; d++) {
              const angle = (d / 8) * Math.PI * 2;
              const dotX = cx + Math.cos(angle) * unitSize * 0.35;
              const dotY = cy + Math.sin(angle) * unitSize * 0.35;
              svg += `<circle cx="${dotX}" cy="${dotY}" r="3" fill="${colors[2] || colors[0]}" />`;
            }
            break;
        }

        svg += '</g>';
      }
    }

    return svg;
  }

  async generatePattern(userId: string, request: GeneratePatternRequest) {
    try {
      const features = await Promise.all(
        request.featureIds.map(id => this.featureRepository.findById(id))
      );

      if (features.some(f => !f)) {
        throw new Error('部分特征数据不存在');
      }

      let colorPalette: string[] = ['#8B4513', '#D4AF37', '#654321', '#F5DEB3', '#800000'];
      if (features.length > 0 && features[0]) {
        const featureColors = features[0].colorPalette;
        if (Array.isArray(featureColors) && featureColors.length > 0) {
          colorPalette = featureColors.slice(0, 5);
        }
      }

      const {
        scale = 1,
        rotation = 0,
        repeatX = 4,
        repeatY = 4,
        spacing = 15,
        patternType = 'floral',
        colors = colorPalette
      } = request.generationParams || {};

      const unitSize = Math.round(150 * scale);
      const totalWidth = unitSize * repeatX + spacing * (repeatX - 1);
      const totalHeight = unitSize * repeatY + spacing * (repeatY - 1);

      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
          <defs>
            <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="#FDF5E6" rx="4"/>
          <g filter="url(#softShadow)">
            ${this.createRepeatingPattern(unitSize, repeatX, repeatY, spacing, colors, patternType, rotation)}
          </g>
        </svg>
      `.trim();

      const outputPath = path.join(config.uploads.path, 'patterns', `pattern_${uuidv4()}.png`);

      await sharp(Buffer.from(svgContent))
        .png({ quality: 95, compressionLevel: 6 })
        .toFile(outputPath);

      const pattern = await this.patternRepository.create({
        name: request.name || `纹样_${Date.now()}`,
        description: request.description || '',
        imageUrl: outputPath,
        thumbnailUrl: outputPath,
        generationParams: {
          scale,
          rotation,
          repeatX,
          repeatY,
          spacing,
          patternType,
          colors,
        },
        isPublic: request.isPublic || false,
        creator: { connect: { id: userId } },
        features: { connect: request.featureIds.map(id => ({ id })) },
      });

      logger.info(`Pattern generated: ${pattern.id} by user: ${userId}`);
      return pattern;
    } catch (error) {
      logger.error('Pattern generation failed:', error);
      throw error;
    }
  }

  private async createPatternImage(request: GeneratePatternRequest): Promise<string> {
    const { scale = 1, rotation = 0, repeatX = 3, repeatY = 3, spacing = 10, colors } = request.generationParams || {};
    
    const unitSize = 300 * scale;
    const width = unitSize * repeatX + spacing * (repeatX - 1);
    const height = unitSize * repeatY + spacing * (repeatY - 1);
    
    const svgPattern = this.createRepeatingPattern(unitSize, repeatX, repeatY, spacing, colors || ['#8B4513', '#D4AF37'], 'floral', rotation);
    
    const outputPath = path.join(config.uploads.path, 'patterns', `pattern_${uuidv4()}.png`);
    
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgPattern}</svg>`))
      .resize(Math.round(width), Math.round(height))
      .png({ quality: 90 })
      .toFile(outputPath);

    return outputPath;
  }

  private generateSVGPattern(size: number, scale: number, rotation: number, colors: string[]): string {
    const center = size / 2;
    const patternSize = size * scale;
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <pattern id="ethnicPattern" width="${patternSize}" height="${patternSize}" patternUnits="userSpaceOnUse">
            <g transform="rotate(${rotation} ${patternSize/2} ${patternSize/2})">
              <polygon 
                points="${this.generatePolygonPoints(patternSize)}" 
                fill="${colors[0]}" 
                stroke="${colors[1]}" 
                stroke-width="2"
              />
              <circle cx="${patternSize/2}" cy="${patternSize/2}" r="${patternSize/6}" fill="${colors[1] || '#FFFFFF'}"/>
              <path 
                d="${this.generateFloralPath(patternSize)}" 
                fill="none" 
                stroke="${colors[0]}" 
                stroke-width="1.5"
              />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ethnicPattern)"/>
      </svg>
    `;
  }

  private generatePolygonPoints(size: number): string {
    const points: string[] = [];
    const sides = 6 + Math.floor(Math.random() * 4);
    const center = size / 2;
    const radius = size / 3;
    
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      points.push(`${x},${y}`);
    }
    
    return points.join(' ');
  }

  private generateFloralPath(size: number): string {
    const center = size / 2;
    let path = `M ${center} ${center * 0.6} `;
    
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = center + Math.cos(angle) * size * 0.3;
      const y = center + Math.sin(angle) * size * 0.3;
      path += `Q ${center} ${center} ${x} ${y} `;
    }
    
    return path;
  }

  async getPatterns(page: number, pageSize: number, isPublic?: boolean) {
    if (isPublic) {
      return this.patternRepository.findPublic(page, pageSize);
    }
    return this.patternRepository.findPaginated(page, pageSize, {
      include: { creator: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPatternsByUser(userId: string, page: number, pageSize: number) {
    return this.patternRepository.findByUser(userId, page, pageSize);
  }

  async getPatternById(id: string) {
    const pattern = await this.patternRepository.findById(id);
    if (!pattern) {
      throw new Error('图案不存在');
    }
    return pattern;
  }

  async updatePattern(id: string, userId: string, data: { name?: string; description?: string; isPublic?: boolean }) {
    const pattern = await this.patternRepository.findById(id);
    if (!pattern) {
      throw new Error('图案不存在');
    }

    if (pattern.createdBy !== userId) {
      throw new Error('无权限修改此图案');
    }

    const updated = await this.patternRepository.update(id, data);
    logger.info(`Pattern updated: ${id} by user: ${userId}`);
    return updated;
  }

  async deletePattern(id: string, userId: string) {
    const pattern = await this.patternRepository.findById(id);
    if (!pattern) {
      throw new Error('图案不存在');
    }

    if (pattern.createdBy !== userId) {
      throw new Error('无权限删除此图案');
    }

    await this.patternRepository.delete(id);
    logger.info(`Pattern deleted: ${id} by user: ${userId}`);
  }

  async getStats() {
    const [total, publicCount] = await Promise.all([
      this.patternRepository.count(),
      this.patternRepository.count({ where: { isPublic: true } }),
    ]);

    return { total, public: publicCount };
  }
}
