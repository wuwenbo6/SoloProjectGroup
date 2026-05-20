import { EventEmitter } from 'events';
import { PDFDocument, StandardFonts, rgb, degrees, grayscale } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as iconv from 'iconv-lite';

export interface WatermarkConfig {
  text: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  rotation?: number;
  position?: 'center' | 'diagonal' | 'header' | 'footer';
  spacing?: number;
}

export interface FormatConversionOptions {
  targetFormat: 'txt' | 'pdf' | 'html' | 'rtf' | 'md' | 'docx';
  encoding?: string;
  preserveFormatting?: boolean;
  lineEndings?: 'lf' | 'crlf' | 'cr';
}

export interface BatchJob {
  id: string;
  type: 'watermark' | 'convert' | 'export';
  sourceFiles: string[];
  outputDir: string;
  config: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  results: Array<{ file: string; success: boolean; output?: string; error?: string }>;
  createdAt: number;
  completedAt?: number;
}

export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
  description: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { name: '纯文本', extension: '.txt', mimeType: 'text/plain', description: '标准纯文本格式' },
  { name: 'PDF文档', extension: '.pdf', mimeType: 'application/pdf', description: '便携式文档格式' },
  { name: 'HTML网页', extension: '.html', mimeType: 'text/html', description: '网页格式，保留样式' },
  { name: 'RTF富文本', extension: '.rtf', mimeType: 'application/rtf', description: '富文本格式' },
  { name: 'Markdown', extension: '.md', mimeType: 'text/markdown', description: 'Markdown标记语言' }
];

export class BatchProcessorModule extends EventEmitter {
  private jobs: Map<string, BatchJob> = new Map();
  private concurrentLimit: number = 3;
  private activeJobs: number = 0;

  constructor() {
    super();
  }

  getSupportedFormats(): ExportFormat[] {
    return [...EXPORT_FORMATS];
  }

  createJob(
    type: BatchJob['type'],
    sourceFiles: string[],
    outputDir: string,
    config: any
  ): BatchJob {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: BatchJob = {
      id,
      type,
      sourceFiles,
      outputDir,
      config,
      status: 'pending',
      progress: 0,
      total: sourceFiles.length,
      results: [],
      createdAt: Date.now()
    };

    this.jobs.set(id, job);
    this.emit('job-created', { jobId: id, type });
    return job;
  }

  async startJob(jobId: string): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.status = 'processing';
    this.emit('job-started', { jobId });

    await fs.mkdir(job.outputDir, { recursive: true });

    for (let i = 0; i < job.sourceFiles.length; i++) {
      while (this.activeJobs >= this.concurrentLimit) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.activeJobs++;
      
      try {
        const sourceFile = job.sourceFiles[i];
        let outputFile: string | undefined;

        switch (job.type) {
          case 'watermark':
            outputFile = await this.addWatermarkToFile(sourceFile, job.outputDir, job.config);
            break;
          case 'convert':
            outputFile = await this.convertFileFormat(sourceFile, job.outputDir, job.config);
            break;
          case 'export':
            outputFile = await this.exportFile(sourceFile, job.outputDir, job.config);
            break;
        }

        job.results.push({ file: sourceFile, success: true, output: outputFile });
      } catch (error) {
        job.results.push({
          file: job.sourceFiles[i],
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      this.activeJobs--;
      job.progress = i + 1;
      this.emit('job-progress', { jobId, progress: job.progress, total: job.total });
    }

    job.status = job.results.every(r => r.success) ? 'completed' : 'failed';
    job.completedAt = Date.now();
    this.emit('job-completed', { jobId, status: job.status, results: job.results });

    return job;
  }

  private async addWatermarkToFile(
    sourceFile: string,
    outputDir: string,
    config: WatermarkConfig
  ): Promise<string> {
    const ext = path.extname(sourceFile).toLowerCase();
    const fileName = path.basename(sourceFile, ext);
    const outputPath = path.join(outputDir, `${fileName}_watermarked${ext}`);

    if (ext === '.pdf') {
      await this.addWatermarkToPdf(sourceFile, outputPath, config);
    } else if (['.txt', '.md', '.html'].includes(ext)) {
      await this.addWatermarkToText(sourceFile, outputPath, config);
    } else {
      throw new Error(`Unsupported file format for watermark: ${ext}`);
    }

    return outputPath;
  }

  private async addWatermarkToPdf(
    sourcePath: string,
    outputPath: string,
    config: WatermarkConfig
  ): Promise<void> {
    const pdfBytes = await fs.readFile(sourcePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fontSize = config.fontSize || 48;
    const opacity = config.opacity || 0.3;
    const rotation = config.rotation || 45;

    for (const page of pages) {
      const { width, height } = page.getSize();

      if (config.position === 'diagonal') {
        const diagonalCount = 3;
        for (let i = 0; i < diagonalCount; i++) {
          const x = width * (0.2 + i * 0.3);
          const y = height * (0.3 + i * 0.25);
          
          page.drawText(config.text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(config.color?.r || 0.5, config.color?.g || 0.5, config.color?.b || 0.5),
            opacity,
            rotate: degrees(rotation)
          });
        }
      } else if (config.position === 'header') {
        page.drawText(config.text, {
          x: width / 2 - font.widthOfTextAtSize(config.text, fontSize) / 2,
          y: height - 50,
          size: fontSize / 2,
          font,
          color: grayscale(0.5),
          opacity: opacity + 0.2
        });
      } else if (config.position === 'footer') {
        page.drawText(config.text, {
          x: width / 2 - font.widthOfTextAtSize(config.text, fontSize / 2) / 2,
          y: 30,
          size: fontSize / 2,
          font,
          color: grayscale(0.5),
          opacity: opacity + 0.2
        });
      } else {
        page.drawText(config.text, {
          x: width / 2 - font.widthOfTextAtSize(config.text, fontSize) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(config.color?.r || 0.5, config.color?.g || 0.5, config.color?.b || 0.5),
          opacity,
          rotate: degrees(rotation)
        });
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
  }

  private async addWatermarkToText(
    sourcePath: string,
    outputPath: string,
    config: WatermarkConfig
  ): Promise<void> {
    let content = await fs.readFile(sourcePath, 'utf-8');
    const watermarkLine = `\n\n--- ${config.text} ---\n`;
    content = watermarkLine + content + watermarkLine;
    await fs.writeFile(outputPath, content, 'utf-8');
  }

  private async convertFileFormat(
    sourceFile: string,
    outputDir: string,
    options: FormatConversionOptions
  ): Promise<string> {
    const ext = path.extname(sourceFile).toLowerCase();
    const fileName = path.basename(sourceFile, ext);
    const targetExt = this.getExtensionForFormat(options.targetFormat);
    const outputPath = path.join(outputDir, `${fileName}${targetExt}`);

    let content = await fs.readFile(sourceFile, 'utf-8');
    let convertedContent: string | Buffer;

    switch (options.targetFormat) {
      case 'txt':
        convertedContent = this.convertToTxt(content, options);
        break;
      case 'pdf':
        await this.convertToPdf(content, outputPath, options);
        return outputPath;
      case 'html':
        convertedContent = this.convertToHtml(content, path.basename(sourceFile));
        break;
      case 'rtf':
        convertedContent = this.convertToRtf(content);
        break;
      case 'md':
        convertedContent = this.convertToMarkdown(content);
        break;
      default:
        convertedContent = content;
    }

    if (typeof convertedContent === 'string') {
      if (options.encoding && options.encoding !== 'utf-8') {
        await fs.writeFile(outputPath, iconv.encode(convertedContent, options.encoding));
      } else {
        await fs.writeFile(outputPath, '\ufeff' + convertedContent, 'utf-8');
      }
    }

    return outputPath;
  }

  private convertToTxt(content: string, options: FormatConversionOptions): string {
    let result = content.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n');
    
    if (options.lineEndings === 'crlf') {
      result = result.replace(/\n/g, '\r\n');
    } else if (options.lineEndings === 'cr') {
      result = result.replace(/\n/g, '\r');
    }

    return result;
  }

  private async convertToPdf(
    content: string,
    outputPath: string,
    options: FormatConversionOptions
  ): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Courier);
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const fontSize = 12;
    const margin = 50;
    const maxWidth = width - margin * 2;
    const lines = this.wrapTextForPdf(content, font, fontSize, maxWidth);

    let y = height - margin;
    for (const line of lines) {
      if (y < margin) {
        const newPage = pdfDoc.addPage();
        y = newPage.getHeight() - margin;
        newPage.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      } else {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      }
      y -= fontSize * 1.5;
    }

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
  }

  private convertToHtml(content: string, title: string): string {
    const lines = content.split('\n');
    const htmlLines = lines.map(line => {
      if (line.trim() === '') return '<p>&nbsp;</p>';
      return `<p>${this.escapeHtml(line)}</p>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 40px; line-height: 1.6; }
    p { margin: 0; white-space: pre-wrap; }
  </style>
</head>
<body>
${htmlLines}
</body>
</html>`;
  }

  private convertToRtf(content: string): string {
    const escapedContent = content
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\par\n');

    return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fmodern Courier New;}}
\\f0\\fs24 ${escapedContent}
}`;
  }

  private convertToMarkdown(content: string): string {
    const lines = content.split('\n');
    let result = '';
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.trim() === '') {
        result += '\n';
      } else if (/^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length > 5) {
        result += `## ${line.trim()}\n`;
      } else if (/^\s*\d+\./.test(line)) {
        result += `${line}\n`;
      } else {
        result += `${line}\n`;
      }
    }

    return result;
  }

  private wrapTextForPdf(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  private getExtensionForFormat(format: string): string {
    const formatInfo = EXPORT_FORMATS.find(f => f.name.toLowerCase().includes(format.toLowerCase()) ||
      f.extension === `.${format}`);
    return formatInfo?.extension || '.txt';
  }

  private async exportFile(sourceFile: string, outputDir: string, config: any): Promise<string> {
    return this.convertFileFormat(sourceFile, outputDir, config);
  }

  async batchWatermark(
    sourceFiles: string[],
    outputDir: string,
    config: WatermarkConfig
  ): Promise<BatchJob> {
    const job = this.createJob('watermark', sourceFiles, outputDir, config);
    return this.startJob(job.id);
  }

  async batchConvert(
    sourceFiles: string[],
    outputDir: string,
    options: FormatConversionOptions
  ): Promise<BatchJob> {
    const job = this.createJob('convert', sourceFiles, outputDir, options);
    return this.startJob(job.id);
  }

  getJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): BatchJob[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'failed';
      this.emit('job-cancelled', { jobId });
      return true;
    }
    return false;
  }

  clearCompletedJobs(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(id);
      }
    }
  }

  setConcurrentLimit(limit: number): void {
    this.concurrentLimit = Math.max(1, limit);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async generatePreview(sourceFile: string, format: string): Promise<string> {
    const content = await fs.readFile(sourceFile, 'utf-8');
    const maxLength = 500;
    const preview = content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
    
    return preview;
  }
}
