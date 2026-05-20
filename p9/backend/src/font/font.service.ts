import { Injectable, Logger } from '@nestjs/common';
import * as opentype from 'opentype.js';
import { FontMetadata, GlyphInfo, KerningPair, TypographyConfig, OptimizedFonts } from './font.interface';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as ttf2woff2 from 'ttf2woff2';

@Injectable()
export class FontService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly logger = new Logger(FontService.name);
  private fonts: Map<string, FontMetadata> = new Map();
  private configs: Map<string, TypographyConfig> = new Map();

  constructor() {
    this.ensureDirectories();
    this.loadData();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadData() {
    const fontsPath = path.join(this.dataDir, 'fonts.json');
    const configsPath = path.join(this.dataDir, 'configs.json');

    if (fs.existsSync(fontsPath)) {
      const data = JSON.parse(fs.readFileSync(fontsPath, 'utf-8'));
      data.forEach((font: FontMetadata) => this.fonts.set(font.id, font));
    }

    if (fs.existsSync(configsPath)) {
      const data = JSON.parse(fs.readFileSync(configsPath, 'utf-8'));
      data.forEach((config: TypographyConfig) => this.configs.set(config.id, config));
    }
  }

  private saveData() {
    const fontsPath = path.join(this.dataDir, 'fonts.json');
    const configsPath = path.join(this.dataDir, 'configs.json');

    fs.writeFileSync(fontsPath, JSON.stringify(Array.from(this.fonts.values()), null, 2));
    fs.writeFileSync(configsPath, JSON.stringify(Array.from(this.configs.values()), null, 2));
  }

  async processFontFile(file: Express.Multer.File): Promise<FontMetadata> {
    const font = await opentype.load(file.path);
    
    const glyphs: GlyphInfo[] = [];
    const charSet = new Set<string>();
    
    const maxGlyphs = 500;
    let processedCount = 0;
    
    for (let i = 0; i < font.glyphs.length && processedCount < maxGlyphs; i++) {
      const glyph = font.glyphs.get(i);
      if (glyph && glyph.unicode && glyph.name) {
        const char = String.fromCodePoint(glyph.unicode);
        if (!charSet.has(char)) {
          charSet.add(char);
          glyphs.push({
            name: glyph.name,
            unicode: glyph.unicode,
            char: char,
            advanceWidth: glyph.advanceWidth,
            xMin: glyph.xMin || 0,
            xMax: glyph.xMax || 0,
            yMin: glyph.yMin || 0,
            yMax: glyph.yMax || 0,
          });
          processedCount++;
        }
      }
    }

    const kerningPairs: KerningPair[] = [];
    const maxKerningPairs = 100;
    
    try {
      if (font.kerning && font.kerning.tables) {
        const commonChars = ['A', 'V', 'W', 'T', 'Y', 'L', 'P', 'F', 'a', 'v', 'w', 't', 'y', 'o', 'e', 'r'];
        const commonUnicodes = commonChars.map(c => c.charCodeAt(0));
        
        for (const leftUnicode of commonUnicodes) {
          for (const rightUnicode of commonUnicodes) {
            try {
              const leftGlyph = font.charToGlyph(String.fromCodePoint(leftUnicode));
              const rightGlyph = font.charToGlyph(String.fromCodePoint(rightUnicode));
              if (leftGlyph && rightGlyph) {
                const kern = font.getKerningValue(leftGlyph, rightGlyph);
                if (kern !== 0) {
                  kerningPairs.push({
                    left: leftUnicode,
                    right: rightUnicode,
                    value: kern,
                  });
                }
              }
            } catch (e) {
            }
            if (kerningPairs.length >= maxKerningPairs) break;
          }
          if (kerningPairs.length >= maxKerningPairs) break;
        }
      }
    } catch (error) {
      console.warn('Kerning parsing failed, continuing without kerning info:', error.message);
    }

    const id = uuidv4();
    const originalExt = path.extname(file.originalname).toLowerCase();
    const fileName = `${id}${originalExt}`;
    const newFilePath = path.join(this.uploadDir, fileName);
    
    fs.renameSync(file.path, newFilePath);

    const optimized = await this.generateOptimizedFonts(id, newFilePath, originalExt);

    const metadata: FontMetadata = {
      id,
      name: font.names.fullName?.en || file.originalname,
      familyName: font.names.fontFamily?.en || 'Unknown',
      styleName: font.names.fontSubfamily?.en || 'Regular',
      version: font.names.version?.en || '1.0',
      unitsPerEm: font.unitsPerEm,
      ascender: font.ascender,
      descender: font.descender,
      numGlyphs: font.numGlyphs,
      glyphs: glyphs,
      kerningPairs: kerningPairs,
      fileName,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      optimized,
      originalFormat: originalExt.slice(1),
    };

    this.fonts.set(id, metadata);
    this.saveData();

    return metadata;
  }

  private async generateOptimizedFonts(id: string, sourcePath: string, sourceExt: string): Promise<OptimizedFonts> {
    const result: OptimizedFonts = {
      sizes: {
        original: fs.statSync(sourcePath).size,
      },
    };

    try {
      if (sourceExt === '.ttf' || sourceExt === '.otf') {
        const ttfBuffer = fs.readFileSync(sourcePath);
        const woff2Buffer = ttf2woff2(ttfBuffer);
        const woff2FileName = `${id}.woff2`;
        const woff2Path = path.join(this.uploadDir, woff2FileName);
        fs.writeFileSync(woff2Path, woff2Buffer);
        result.woff2 = woff2FileName;
        result.sizes.woff2 = woff2Buffer.length;
        
        const savedPercent = Math.round((1 - woff2Buffer.length / result.sizes.original) * 100);
        this.logger.log(`WOFF2 generated for ${id}, size reduced ${savedPercent}%`);
      }

      if (sourceExt === '.ttf') {
        const otfFileName = `${id}.otf`;
        const otfPath = path.join(this.uploadDir, otfFileName);
        fs.copyFileSync(sourcePath, otfPath);
        result.otf = otfFileName;
        result.sizes.otf = result.sizes.original;
      }
    } catch (error) {
      this.logger.warn(`Failed to generate optimized fonts: ${error.message}`);
    }

    return result;
  }

  getAllFonts(): FontMetadata[] {
    return Array.from(this.fonts.values());
  }

  getFontById(id: string): FontMetadata | undefined {
    return this.fonts.get(id);
  }

  deleteFont(id: string): boolean {
    const font = this.fonts.get(id);
    if (font) {
      const filePath = path.join(this.uploadDir, font.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (font.optimized) {
        if (font.optimized.woff2) {
          const woff2Path = path.join(this.uploadDir, font.optimized.woff2);
          if (fs.existsSync(woff2Path)) {
            fs.unlinkSync(woff2Path);
          }
        }
        if (font.optimized.otf) {
          const otfPath = path.join(this.uploadDir, font.optimized.otf);
          if (fs.existsSync(otfPath)) {
            fs.unlinkSync(otfPath);
          }
        }
      }

      this.fonts.delete(id);
      this.saveData();
      return true;
    }
    return false;
  }

  saveConfig(config: TypographyConfig): TypographyConfig {
    if (!config.id) {
      config.id = uuidv4();
      config.createdAt = new Date().toISOString();
    }
    config.updatedAt = new Date().toISOString();
    this.configs.set(config.id, config);
    this.saveData();
    return config;
  }

  getAllConfigs(): TypographyConfig[] {
    return Array.from(this.configs.values());
  }

  getConfigById(id: string): TypographyConfig | undefined {
    return this.configs.get(id);
  }

  deleteConfig(id: string): boolean {
    const result = this.configs.delete(id);
    if (result) {
      this.saveData();
    }
    return result;
  }
}
