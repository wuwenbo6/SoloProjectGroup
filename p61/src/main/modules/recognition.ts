import { createWorker, PSM, OEM } from 'tesseract.js';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RecognitionResult {
  text: string;
  confidence: number;
  fontType?: string;
  fontSize?: number;
  characters: CharacterRecognition[];
  processingTime: number;
  preprocessingSteps: string[];
}

export interface CharacterRecognition {
  char: string;
  confidence: number;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  alternatives: Array<{ char: string; confidence: number }>;
}

export interface FontStyle {
  id: string;
  name: string;
  typewriterModel: string;
  sampleImage?: string;
  characteristics: {
    serif: boolean;
    boldness: number;
    spacing: number;
    slant: number;
  };
  charset: string[];
  createdAt: number;
}

export interface RecognitionOptions {
  language?: string;
  psm?: number;
  oem?: number;
  charWhitelist?: string;
  enhanceContrast?: boolean;
  deskew?: boolean;
  removeNoise?: boolean;
}

const TYPEWRITER_FONTS = [
  { name: 'Courier', serif: true, boldness: 0.5, spacing: 1.0, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
  { name: 'Pica', serif: true, boldness: 0.6, spacing: 1.1, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
  { name: 'Elite', serif: true, boldness: 0.4, spacing: 0.9, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
  { name: 'Script', serif: false, boldness: 0.7, spacing: 1.2, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' },
  { name: 'Gothic', serif: false, boldness: 0.8, spacing: 1.0, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' }
];

const TYPEWRITER_CHAR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:\'"()-@#$%&*+=[]{}|\\/<> \n\r\t';

const CHARACTER_CORRECTIONS: Map<string, string[]> = new Map([
  ['0', ['O', 'Q', 'D']],
  ['1', ['I', 'l', '|', '!']],
  ['2', ['Z', 'z']],
  ['5', ['S', 's']],
  ['8', ['B']],
  ['I', ['1', 'l', '|']],
  ['l', ['1', 'I', '|']],
  ['O', ['0', 'Q']],
  ['Q', ['0', 'O']],
  ['Z', ['2', 'z']],
  ['S', ['5', 's']]
]);

export class ImageRecognitionModule extends EventEmitter {
  private worker: any = null;
  private isInitialized: boolean = false;
  private fontStyles: Map<string, FontStyle> = new Map();
  private correctionDictionary: Map<string, string> = new Map();

  constructor() {
    super();
    this.loadCorrectionDictionary();
  }

  private loadCorrectionDictionary(): void {
    CHARACTER_CORRECTIONS.forEach((alternatives, correct) => {
      alternatives.forEach(alt => {
        this.correctionDictionary.set(alt, correct);
      });
    });
  }

  async initialize(options?: RecognitionOptions): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await createWorker(options?.language || 'eng', OEM.LSTM_ONLY, {
        logger: m => {
          if (m.status === 'recognizing text') {
            this.emit('progress', { progress: m.progress });
          }
        }
      });

      await this.worker.setParameters({
        tessedit_pageseg_mode: options?.psm || PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: options?.charWhitelist || TYPEWRITER_CHAR_WHITELIST,
        preserve_interword_spaces: '1'
      });

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  async recognizeImage(imageData: string, options?: RecognitionOptions): Promise<RecognitionResult> {
    const startTime = Date.now();
    const preprocessingSteps: string[] = [];

    if (!this.isInitialized) {
      await this.initialize(options);
    }

    try {
      if (options?.charWhitelist) {
        await this.worker.setParameters({
          tessedit_char_whitelist: options.charWhitelist
        });
      }

      const { data } = await this.worker.recognize(imageData);
      
      let characters: CharacterRecognition[] = data.words.flatMap((word: any) =>
        word.symbols.map((symbol: any) => ({
          char: symbol.text,
          confidence: symbol.confidence,
          boundingBox: {
            left: symbol.bbox.x0,
            top: symbol.bbox.y0,
            width: symbol.bbox.x1 - symbol.bbox.x0,
            height: symbol.bbox.y1 - symbol.bbox.y0
          },
          alternatives: symbol.alternatives?.slice(0, 3).map((alt: any) => ({
            char: alt.text,
            confidence: alt.confidence
          })) || []
        }))
      );

      characters = this.applyCharacterCorrections(characters);
      preprocessingSteps.push('字符校正');

      const avgCharWidth = characters.length > 0
        ? characters.reduce((sum, c) => sum + c.boundingBox.width, 0) / characters.length
        : 0;
      
      characters = this.resolveAmbiguousCharacters(characters, avgCharWidth);
      preprocessingSteps.push('歧义字符解析');

      const correctedText = characters.map(c => c.char).join('');
      const finalConfidence = this.calculateAdjustedConfidence(characters);

      const fontType = this.detectFontStyle(data, characters);

      const processingTime = Date.now() - startTime;

      const result: RecognitionResult = {
        text: correctedText,
        confidence: Math.min(finalConfidence, 100),
        fontType,
        characters,
        processingTime,
        preprocessingSteps
      };

      this.emit('recognition-complete', result);
      return result;
    } catch (error) {
      console.error('Recognition failed:', error);
      this.emit('recognition-error', error);
      throw error;
    }
  }

  private applyCharacterCorrections(characters: CharacterRecognition[]): CharacterRecognition[] {
    return characters.map(char => {
      if (char.confidence < 85) {
        const corrected = this.correctionDictionary.get(char.char);
        if (corrected) {
          return {
            ...char,
            char: corrected,
            confidence: char.confidence + 10,
            alternatives: [...char.alternatives, { char: char.char, confidence: char.confidence }]
          };
        }
      }
      return char;
    });
  }

  private resolveAmbiguousCharacters(
    characters: CharacterRecognition[],
    avgCharWidth: number
  ): CharacterRecognition[] {
    return characters.map((char, index) => {
      if (char.confidence >= 90) return char;

      const widthRatio = avgCharWidth > 0 ? char.boundingBox.width / avgCharWidth : 1;

      if (char.char === '0' || char.char === 'O') {
        if (widthRatio > 1.1) {
          return { ...char, char: 'O', confidence: Math.min(char.confidence + 5, 100) };
        } else if (widthRatio < 0.95) {
          return { ...char, char: '0', confidence: Math.min(char.confidence + 5, 100) };
        }
      }

      if (char.char === '1' || char.char === 'I' || char.char === 'l') {
        if (widthRatio < 0.6) {
          return { ...char, char: 'l', confidence: Math.min(char.confidence + 5, 100) };
        } else if (widthRatio > 0.8) {
          return { ...char, char: '1', confidence: Math.min(char.confidence + 5, 100) };
        }
      }

      const prevChar = index > 0 ? characters[index - 1] : null;
      const nextChar = index < characters.length - 1 ? characters[index + 1] : null;
      
      if (prevChar && nextChar) {
        const prevIsDigit = /\d/.test(prevChar.char);
        const nextIsDigit = /\d/.test(nextChar.char);
        const prevIsLetter = /[a-zA-Z]/.test(prevChar.char);
        const nextIsLetter = /[a-zA-Z]/.test(nextChar.char);

        if ((prevIsDigit && nextIsDigit) && /[OIlZS]/.test(char.char)) {
          const digitMap: Record<string, string> = { 'O': '0', 'I': '1', 'l': '1', 'Z': '2', 'S': '5' };
          return { ...char, char: digitMap[char.char] || char.char, confidence: Math.min(char.confidence + 8, 100) };
        }

        if ((prevIsLetter && nextIsLetter) && /[01258]/.test(char.char)) {
          const letterMap: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B' };
          return { ...char, char: letterMap[char.char] || char.char, confidence: Math.min(char.confidence + 8, 100) };
        }
      }

      return char;
    });
  }

  private calculateAdjustedConfidence(characters: CharacterRecognition[]): number {
    if (characters.length === 0) return 0;

    const totalConfidence = characters.reduce((sum, c) => sum + c.confidence, 0);
    const avgConfidence = totalConfidence / characters.length;

    const validChars = characters.filter(c => c.confidence >= 70).length;
    const validityRatio = validChars / characters.length;

    return Math.round(avgConfidence * 0.7 + validityRatio * 100 * 0.3);
  }

  private detectFontStyle(ocrData: any, characters: CharacterRecognition[]): string {
    const avgConfidence = ocrData.confidence || 80;
    const text = characters.map(c => c.char).join('');
    
    if (characters.length === 0) return TYPEWRITER_FONTS[0].name;

    const uppercaseRatio = text.replace(/[^A-Z]/g, '').length / Math.max(text.length, 1);
    const spacingVariance = this.calculateSpacingVariance(ocrData.words || []);
    
    const avgCharWidth = characters.reduce((sum, c) => sum + c.boundingBox.width, 0) / characters.length;
    const avgCharHeight = characters.reduce((sum, c) => sum + c.boundingBox.height, 0) / characters.length;
    const aspectRatio = avgCharWidth / avgCharHeight;

    let bestMatch = TYPEWRITER_FONTS[0];
    let bestScore = -Infinity;

    for (const font of TYPEWRITER_FONTS) {
      let score = 0;
      
      if (uppercaseRatio > 0.7 && font.boldness > 0.5) score += 20;
      if (spacingVariance < 0.1 && font.spacing > 0.95) score += 30;
      if (avgConfidence > 90 && font.serif) score += 20;
      
      const widthDiff = Math.abs(aspectRatio - font.spacing);
      score += Math.max(0, 30 - widthDiff * 100);
      
      if (aspectRatio < 0.55 && font.name === 'Elite') score += 25;
      if (aspectRatio > 0.65 && font.name === 'Pica') score += 25;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = font;
      }
    }

    return bestMatch.name;
  }

  private calculateSpacingVariance(words: any[]): number {
    if (words.length < 2) return 0;
    
    const spacings: number[] = [];
    for (let i = 1; i < words.length; i++) {
      const prevRight = words[i - 1].bbox?.x1 || 0;
      const currLeft = words[i].bbox?.x0 || 0;
      spacings.push(currLeft - prevRight);
    }
    
    if (spacings.length === 0) return 0;
    
    const avg = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const variance = spacings.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / spacings.length;
    
    return Math.sqrt(variance) / Math.max(avg, 1);
  }

  async batchRecognize(
    imagePaths: string[],
    options?: RecognitionOptions
  ): Promise<Array<{ path: string; result?: RecognitionResult; error?: string }>> {
    const results: Array<{ path: string; result?: RecognitionResult; error?: string }> = [];

    for (const imagePath of imagePaths) {
      try {
        const imageData = await fs.readFile(imagePath, 'base64');
        const dataUrl = `data:image/${path.extname(imagePath).slice(1)};base64,${imageData}`;
        const result = await this.recognizeImage(dataUrl, options);
        results.push({ path: imagePath, result });
      } catch (error) {
        results.push({ 
          path: imagePath, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return results;
  }

  addFontStyle(style: FontStyle): void {
    this.fontStyles.set(style.id, style);
    this.emit('font-style-added', style);
  }

  getFontStyle(id: string): FontStyle | undefined {
    return this.fontStyles.get(id);
  }

  getAllFontStyles(): FontStyle[] {
    return Array.from(this.fontStyles.values());
  }

  deleteFontStyle(id: string): boolean {
    const deleted = this.fontStyles.delete(id);
    if (deleted) {
      this.emit('font-style-deleted', id);
    }
    return deleted;
  }

  matchFontStyle(characters: CharacterRecognition[]): FontStyle | null {
    if (characters.length === 0) return null;

    const avgWidth = characters.reduce((sum, c) => sum + c.boundingBox.width, 0) / characters.length;
    const avgHeight = characters.reduce((sum, c) => sum + c.boundingBox.height, 0) / characters.length;

    for (const style of this.fontStyles.values()) {
      const widthRatio = avgWidth / 100;
      const heightRatio = avgHeight / 100;
      
      if (Math.abs(widthRatio - style.characteristics.spacing) < 0.2 &&
          Math.abs(heightRatio - style.characteristics.boldness) < 0.3) {
        return style;
      }
    }

    return null;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}
