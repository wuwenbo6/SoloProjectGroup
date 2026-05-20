import { EventEmitter } from 'events';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as iconv from 'iconv-lite';

export interface Transcription {
  id: string;
  content: string;
  originalContent?: string;
  typewriterModel?: string;
  fontStyle?: string;
  createdAt: number;
  updatedAt: number;
  corrections: Map<number, string>;
  encoding: string;
  metadata: {
    characterCount: number;
    wordCount: number;
    lineCount: number;
    invalidCharacters: number;
    encodingConfidence: number;
  };
}

export interface ExportOptions {
  format: 'txt' | 'pdf';
  includeMetadata?: boolean;
  includeCorrections?: boolean;
  fontStyle?: string;
  encoding?: string;
  lineHeight?: number;
  fontSize?: number;
  margins?: { top: number; bottom: number; left: number; right: number };
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ position: number; char: string; message: string }>;
  warnings: Array<{ position: number; char: string; message: string }>;
  encoding: string;
  encodingConfidence: number;
}

export class TranscriptionModule extends EventEmitter {
  private transcriptions: Map<string, Transcription> = new Map();
  private readonly SUPPORTED_ENCODINGS = ['utf-8', 'ascii', 'latin1', 'gbk', 'gb2312', 'big5'];
  private readonly CONTROL_CHARACTERS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);

  constructor() {
    super();
  }

  createTranscription(
    content: string,
    typewriterModel?: string,
    fontStyle?: string,
    encoding?: string
  ): Transcription {
    const id = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const detectedEncoding = encoding || this.detectEncoding(content);
    const validation = this.validateContent(content);
    const sanitizedContent = this.sanitizeContent(content);

    const transcription: Transcription = {
      id,
      content: sanitizedContent,
      originalContent: content,
      typewriterModel,
      fontStyle,
      createdAt: now,
      updatedAt: now,
      corrections: new Map(),
      encoding: detectedEncoding,
      metadata: {
        ...this.calculateMetadata(sanitizedContent),
        invalidCharacters: validation.errors.length,
        encodingConfidence: validation.encodingConfidence
      }
    };

    this.transcriptions.set(id, transcription);
    this.emit('transcription-created', transcription);

    return transcription;
  }

  detectEncoding(content: string): string {
    const buffer = Buffer.from(content);
    
    let bestEncoding = 'utf-8';
    let bestScore = 0;

    for (const encoding of this.SUPPORTED_ENCODINGS) {
      try {
        const decoded = iconv.decode(buffer, encoding);
        const score = this.calculateEncodingScore(decoded);
        if (score > bestScore) {
          bestScore = score;
          bestEncoding = encoding;
        }
      } catch {
        continue;
      }
    }

    return bestEncoding;
  }

  private calculateEncodingScore(text: string): number {
    let score = 100;

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      
      if (charCode === 0xFFFD || charCode === 65533) {
        score -= 20;
      }
      
      if (this.CONTROL_CHARACTERS.has(charCode)) {
        score -= 5;
      }
    }

    const printableRatio = text.replace(/[\x00-\x1F\x7F]/g, '').length / Math.max(text.length, 1);
    score += printableRatio * 30;

    return Math.max(0, Math.min(100, score));
  }

  validateContent(content: string): ValidationResult {
    const errors: Array<{ position: number; char: string; message: string }> = [];
    const warnings: Array<{ position: number; char: string; message: string }> = [];

    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i);
      const char = content[i];

      if (this.CONTROL_CHARACTERS.has(charCode)) {
        errors.push({
          position: i,
          char,
          message: `发现控制字符 (0x${charCode.toString(16).padStart(2, '0')})`
        });
      }

      if (charCode === 0xFFFD) {
        errors.push({
          position: i,
          char: '�',
          message: '发现替换字符，可能是编码问题'
        });
      }

      if (charCode > 0x7F && charCode < 0xA0) {
        warnings.push({
          position: i,
          char,
          message: `发现可疑 C1 控制字符 (0x${charCode.toString(16)})`
        });
      }
    }

    const encodingConfidence = this.calculateEncodingScore(content);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      encoding: this.detectEncoding(content),
      encodingConfidence
    };
  }

  sanitizeContent(content: string): string {
    let result = '';

    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i);

      if (charCode === 9 || charCode === 10 || charCode === 13) {
        result += content[i];
        continue;
      }

      if (this.CONTROL_CHARACTERS.has(charCode)) {
        continue;
      }

      if (charCode === 0xFFFD) {
        result += '□';
        continue;
      }

      result += content[i];
    }

    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/[ \t]+/g, ' ');

    return result.trim();
  }

  private calculateMetadata(content: string): Transcription['metadata'] {
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(w => w.length > 0);

    return {
      characterCount: content.length,
      wordCount: words.length,
      lineCount: lines.length,
      invalidCharacters: 0,
      encodingConfidence: 100
    };
  }

  correctCharacter(transcriptionId: string, index: number, correction: string): boolean {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription || index < 0 || index >= transcription.content.length) {
      return false;
    }

    transcription.corrections.set(index, correction);

    const contentArray = transcription.content.split('');
    contentArray[index] = correction;
    transcription.content = contentArray.join('');
    transcription.updatedAt = Date.now();
    transcription.metadata = this.calculateMetadata(transcription.content);

    this.emit('character-corrected', { transcriptionId, index, correction });
    return true;
  }

  batchCorrect(transcriptionId: string, corrections: Map<number, string>): boolean {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription) return false;

    const contentArray = transcription.content.split('');

    corrections.forEach((correction, index) => {
      if (index >= 0 && index < contentArray.length) {
        transcription.corrections.set(index, correction);
        contentArray[index] = correction;
      }
    });

    transcription.content = contentArray.join('');
    transcription.updatedAt = Date.now();
    transcription.metadata = this.calculateMetadata(transcription.content);

    this.emit('batch-corrected', { transcriptionId, corrections });
    return true;
  }

  getTranscription(id: string): Transcription | undefined {
    return this.transcriptions.get(id);
  }

  getAllTranscriptions(): Transcription[] {
    return Array.from(this.transcriptions.values());
  }

  deleteTranscription(id: string): boolean {
    const deleted = this.transcriptions.delete(id);
    if (deleted) {
      this.emit('transcription-deleted', id);
    }
    return deleted;
  }

  async exportToTxt(content: string, filePath: string, encoding: string = 'utf-8'): Promise<void> {
    try {
      const sanitized = this.sanitizeContent(content);
      const validation = this.validateContent(sanitized);

      if (!validation.isValid) {
        this.emit('export-warning', {
          format: 'txt',
          filePath,
          issues: validation.errors.length
        });
      }

      let buffer: Buffer;
      if (encoding.toLowerCase() === 'utf-8') {
        buffer = Buffer.from('\ufeff' + sanitized, 'utf-8');
      } else if (iconv.encodingExists(encoding)) {
        buffer = iconv.encode(sanitized, encoding);
      } else {
        buffer = Buffer.from(sanitized, 'utf-8');
      }

      await fs.writeFile(filePath, buffer);
      this.emit('exported', { format: 'txt', filePath, encoding });
    } catch (error) {
      console.error('Failed to export TXT:', error);
      throw error;
    }
  }

  async exportToPdf(
    content: string,
    filePath: string,
    options?: ExportOptions
  ): Promise<void> {
    try {
      const sanitized = this.sanitizeContent(content);
      const validation = this.validateContent(sanitized);

      if (!validation.isValid) {
        this.emit('export-warning', {
          format: 'pdf',
          filePath,
          issues: validation.errors.length
        });
      }

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

      const fontSize = options?.fontSize || 12;
      const lineHeight = options?.lineHeight || fontSize * 1.5;
      const margins = options?.margins || { top: 50, bottom: 50, left: 50, right: 50 };

      const pageSize = [612, 792] as [number, number];
      let page = pdfDoc.addPage(pageSize);
      let [width, height] = pageSize;

      const maxWidth = width - margins.left - margins.right;
      let y = height - margins.top;

      const lines = this.wrapText(sanitized, font, fontSize, maxWidth);
      const pages = this.paginateLines(lines, fontSize, lineHeight, margins, height);

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        if (pageIndex > 0) {
          page = pdfDoc.addPage(pageSize);
          y = height - margins.top;
        }

        const pageLines = pages[pageIndex];

        for (const line of pageLines) {
          const encodedLine = this.encodeTextForPdf(line);
          
          page.drawText(encodedLine, {
            x: margins.left,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0)
          });

          y -= lineHeight;
        }

        if (options?.includeMetadata) {
          const pageNumText = `Page ${pageIndex + 1} of ${pages.length}`;
          const metadataY = margins.bottom / 2;
          
          page.drawText(pageNumText, {
            x: width - margins.right - font.widthOfTextAtSize(pageNumText, 8),
            y: metadataY,
            size: 8,
            font,
            color: rgb(0.5, 0.5, 0.5)
          });
        }
      }

      if (options?.includeMetadata && pages.length > 0) {
        const metadataText = `Character Count: ${sanitized.length} | Exported: ${new Date().toLocaleString()}`;
        const firstPage = pdfDoc.getPage(0);
        const metadataY = margins.bottom / 2;
        
        firstPage.drawText(metadataText, {
          x: margins.left,
          y: metadataY,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.writeFile(filePath, Buffer.from(pdfBytes));

      this.emit('exported', { format: 'pdf', filePath, pageCount: pages.length });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      throw error;
    }
  }

  private encodeTextForPdf(text: string): string {
    let result = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charCode = text.charCodeAt(i);

      if (charCode >= 32 && charCode <= 126) {
        result += char;
      } else if (charCode === 9) {
        result += '    ';
      } else if (charCode === 160) {
        result += ' ';
      } else if (charCode >= 0x410 && charCode <= 0x44F) {
        result += String.fromCharCode(charCode - 0x360);
      } else {
        result += '?';
      }
    }

    return result;
  }

  private paginateLines(
    lines: string[],
    fontSize: number,
    lineHeight: number,
    margins: { top: number; bottom: number },
    pageHeight: number
  ): string[][] {
    const pages: string[][] = [];
    let currentPage: string[] = [];
    let currentY = pageHeight - margins.top;
    const minY = margins.bottom;

    for (const line of lines) {
      if (currentY - lineHeight < minY && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentY = pageHeight - margins.top;
      }

      currentPage.push(line);
      currentY -= lineHeight;
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [[]];
  }

  private wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
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

  async batchExport(
    items: Array<{ id: string; content: string; filePath: string; format: 'txt' | 'pdf' }>,
    options?: ExportOptions
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; filePath: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ id: string; filePath: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of items) {
      try {
        if (item.format === 'txt') {
          await this.exportToTxt(item.content, item.filePath, options?.encoding);
        } else {
          await this.exportToPdf(item.content, item.filePath, options);
        }
        results.push({ id: item.id, filePath: item.filePath, success: true });
        successCount++;
        this.emit('batch-progress', { total: items.length, completed: successCount + failedCount });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ id: item.id, filePath: item.filePath, success: false, error: errorMessage });
        failedCount++;
        console.error(`Batch export failed for ${item.id}:`, errorMessage);
      }
    }

    this.emit('batch-complete', { success: successCount, failed: failedCount, results });
    return { success: successCount, failed: failedCount, results };
  }

  async safeExport(
    content: string,
    filePath: string,
    format: 'txt' | 'pdf',
    options?: ExportOptions
  ): Promise<{ success: boolean; error?: string; backupPath?: string }> {
    const tempPath = `${filePath}.tmp`;

    try {
      if (format === 'txt') {
        await this.exportToTxt(content, tempPath, options?.encoding);
      } else {
        await this.exportToPdf(content, tempPath, options);
      }

      await fs.rename(tempPath, filePath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      try {
        await fs.unlink(tempPath).catch(() => {});
      } catch {
        // Ignore cleanup errors
      }

      try {
        const backupPath = `${filePath}.backup`;
        await fs.writeFile(backupPath, content, 'utf-8');
        return { success: false, error: errorMessage, backupPath };
      } catch (backupError) {
        return { success: false, error: errorMessage };
      }
    }
  }

  async validateAndExport(
    content: string,
    filePath: string,
    format: 'txt' | 'pdf',
    options?: ExportOptions
  ): Promise<{
    success: boolean;
    validation: ValidationResult;
    error?: string;
  }> {
    const validation = this.validateContent(content);

    if (!validation.isValid && validation.errors.length > 10) {
      return {
        success: false,
        validation,
        error: '内容包含过多无效字符，已中止导出'
      };
    }

    try {
      const result = await this.safeExport(content, filePath, format, options);
      return {
        ...result,
        validation
      };
    } catch (error) {
      return {
        success: false,
        validation,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  compareTranscription(id: string): { original: string; corrected: string; diffCount: number } {
    const transcription = this.transcriptions.get(id);
    if (!transcription) {
      throw new Error('Transcription not found');
    }

    const original = transcription.originalContent || transcription.content;
    const corrected = transcription.content;

    let diffCount = 0;
    const minLength = Math.min(original.length, corrected.length);

    for (let i = 0; i < minLength; i++) {
      if (original[i] !== corrected[i]) {
        diffCount++;
      }
    }

    diffCount += Math.abs(original.length - corrected.length);

    return { original, corrected, diffCount };
  }

  mergeTranscriptions(targetId: string, sourceId: string): Transcription {
    const target = this.transcriptions.get(targetId);
    const source = this.transcriptions.get(sourceId);

    if (!target || !source) {
      throw new Error('One or both transcriptions not found');
    }

    target.content += source.content;
    target.updatedAt = Date.now();
    target.metadata = this.calculateMetadata(target.content);

    const offset = (target.originalContent?.length || 0);
    source.corrections.forEach((correction, index) => {
      target.corrections.set(offset + index, correction);
    });

    this.emit('transcriptions-merged', { targetId, sourceId });
    return target;
  }
}
