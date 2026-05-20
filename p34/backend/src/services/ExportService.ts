import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { config } from '../config';
import prisma from '../config/database';
import logger from '../utils/logger';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'jpg';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;
  resolution?: number;
  transparent?: boolean;
  includeMetadata?: boolean;
}

export class ExportService {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(config.uploads.path, 'exports');
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async exportPattern(patternId: string, options: ExportOptions): Promise<string> {
    const pattern = await prisma.generatedPattern.findUnique({
      where: { id: patternId },
    });

    if (!pattern) {
      throw new Error('图案不存在');
    }

    let outputPath: string;

    switch (options.format) {
      case 'png':
        outputPath = await this.exportToPNG(pattern.imageUrl, options);
        break;
      case 'jpg':
        outputPath = await this.exportToJPG(pattern.imageUrl, options);
        break;
      case 'svg':
        outputPath = await this.exportToSVG(pattern.imageUrl, pattern.generationParams, options);
        break;
      case 'pdf':
        outputPath = await this.exportToPDF(pattern.imageUrl, pattern, options);
        break;
      default:
        throw new Error('不支持的导出格式');
    }

    logger.info(`Pattern exported: ${patternId} as ${options.format}`);
    return outputPath;
  }

  async batchExport(patternIds: string[], options: ExportOptions): Promise<string> {
    const batchId = uuidv4();
    const batchDir = path.join(this.outputDir, `batch_${batchId}`);
    fs.mkdirSync(batchDir, { recursive: true });

    try {
      for (const patternId of patternIds) {
        const pattern = await prisma.generatedPattern.findUnique({
          where: { id: patternId },
        });

        if (!pattern) continue;

        const exportedPath = await this.exportPattern(patternId, options);
        const fileName = `${pattern.name.replace(/[^a-z0-9]/gi, '_')}_${patternId.slice(0, 8)}.${options.format}`;
        const destPath = path.join(batchDir, fileName);
        
        fs.copyFileSync(exportedPath, destPath);

        if (options.includeMetadata) {
          const metadataPath = path.join(batchDir, `${pattern.name.replace(/[^a-z0-9]/gi, '_')}_metadata.json`);
          fs.writeFileSync(metadataPath, JSON.stringify({
            id: pattern.id,
            name: pattern.name,
            description: pattern.description,
            createdAt: pattern.createdAt,
            generationParams: pattern.generationParams,
          }, null, 2));
        }
      }

      const zipPath = path.join(this.outputDir, `patterns_export_${batchId}.zip`);
      await this.createZip(batchDir, zipPath);

      fs.rmSync(batchDir, { recursive: true, force: true });

      logger.info(`Batch export completed: ${patternIds.length} patterns`);
      return zipPath;
    } catch (error) {
      fs.rmSync(batchDir, { recursive: true, force: true });
      logger.error('Batch export failed:', error);
      throw new Error('批量导出失败');
    }
  }

  private async exportToPNG(imagePath: string, options: ExportOptions): Promise<string> {
    const outputPath = path.join(this.outputDir, `pattern_${uuidv4()}.png`);
    
    let image = sharp(imagePath);
    
    if (options.resolution) {
      image = image.resize(options.resolution, options.resolution, { fit: 'inside' });
    }

    if (!options.transparent) {
      image = image.flatten({ background: { r: 255, g: 255, b: 255 } });
    }

    await image.png({ quality: options.quality || 95 }).toFile(outputPath);
    return outputPath;
  }

  private async exportToJPG(imagePath: string, options: ExportOptions): Promise<string> {
    const outputPath = path.join(this.outputDir, `pattern_${uuidv4()}.jpg`);
    
    let image = sharp(imagePath);
    
    if (options.resolution) {
      image = image.resize(options.resolution, options.resolution, { fit: 'inside' });
    }

    await image
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: options.quality || 90 })
      .toFile(outputPath);
    
    return outputPath;
  }

  private async exportToSVG(imagePath: string, generationParams: any, options: ExportOptions): Promise<string> {
    const outputPath = path.join(this.outputDir, `pattern_${uuidv4()}.svg`);
    
    const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
    
    const scale = (generationParams?.scale || 1) * (options.resolution ? options.resolution / 1024 : 1);
    
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="${info.width * scale}" height="${info.height * scale}" viewBox="0 0 ${info.width} ${info.height}">
  <defs>
    <filter id="crispEdges">
      <feComponentTransfer>
        <feFuncA type="discrete" tableValues="0 1"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <image href="${imagePath}" width="${info.width}" height="${info.height}" filter="url(#crispEdges)"/>
</svg>`.trim();

    fs.writeFileSync(outputPath, svgContent);
    return outputPath;
  }

  private async exportToPDF(imagePath: string, pattern: any, options: ExportOptions): Promise<string> {
    const outputPath = path.join(this.outputDir, `pattern_${uuidv4()}.pdf`);
    
    const { width, height } = await sharp(imagePath).metadata();
    const pageWidth = options.resolution || Math.min(width || 1024, 1024);
    const pageHeight = options.resolution ? options.resolution * ((height || 1024) / (width || 1024)) : Math.min(height || 1024, 1024);

    const pdfBuffer = await sharp(imagePath)
      .resize(pageWidth, pageHeight, { fit: 'inside' })
      .extend({
        top: 50,
        bottom: 80,
        left: 50,
        right: 50,
        background: { r: 255, g: 255, b: 255 },
      })
      .png()
      .toBuffer();

    const svgWrapper = `
<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth + 100}" height="${pageHeight + 130}">
  <style>
    text { font-family: sans-serif; fill: #333; }
    .title { font-size: 24px; font-weight: bold; }
    .meta { font-size: 12px; }
  </style>
  <rect width="100%" height="100%" fill="white"/>
  <text x="50" y="35" class="title">${pattern.name || '纹样图案'}</text>
  <image x="50" y="50" width="${pageWidth}" height="${pageHeight}" href="data:image/png;base64,${pdfBuffer.toString('base64')}"/>
  <text x="50" y="${pageHeight + 90}" class="meta">描述: ${pattern.description || '无'}</text>
  <text x="50" y="${pageHeight + 110}" class="meta">创建时间: ${pattern.createdAt ? new Date(pattern.createdAt).toLocaleString('zh-CN') : '未知'}</text>
</svg>`.trim();

    await sharp(Buffer.from(svgWrapper))
      .png()
      .toFile(outputPath.replace('.pdf', '.png'));

    fs.renameSync(outputPath.replace('.pdf', '.png'), outputPath);
    return outputPath;
  }

  private async createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  async exportMaterial(materialId: string, options: ExportOptions): Promise<string> {
    const material = await prisma.patternMaterial.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      throw new Error('素材不存在');
    }

    const outputPath = path.join(this.outputDir, `material_${materialId}_${uuidv4()}.${options.format}`);
    
    let image = sharp(material.imageUrl);
    
    if (options.resolution) {
      image = image.resize(options.resolution, options.resolution, { fit: 'inside' });
    }

    switch (options.format) {
      case 'png':
        await image.png({ quality: options.quality || 95 }).toFile(outputPath);
        break;
      case 'jpg':
        await image
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: options.quality || 90 })
          .toFile(outputPath);
        break;
      default:
        await image.png().toFile(outputPath);
    }

    return outputPath;
  }

  cleanupOldFiles(maxAgeHours: number = 24) {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    const files = fs.readdirSync(this.outputDir);
    for (const file of files) {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }

    logger.info(`Cleaned up old export files`);
  }
}
