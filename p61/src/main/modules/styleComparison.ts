import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CharacterStyle {
  id: string;
  name: string;
  typewriterModel: string;
  character: string;
  charCode: number;
  features: {
    width: number;
    height: number;
    strokeWidth: number;
    serif: boolean;
    slant: number;
    aspectRatio: number;
    boundingBox: { left: number; top: number; right: number; bottom: number };
  };
  sampleImage?: string;
  histogram?: number[];
  createdAt: number;
}

export interface StyleComparisonResult {
  similarity: number;
  featureDifferences: {
    width: number;
    height: number;
    strokeWidth: number;
    aspectRatio: number;
    slant: number;
  };
  matchDetails: {
    serifMatch: boolean;
    sizeCategory: 'small' | 'medium' | 'large';
    fontFamily: string;
  };
  recommendations: string[];
}

export interface TypewriterModel {
  id: string;
  name: string;
  manufacturer: string;
  year?: number;
  serialPortConfig: {
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: 'none' | 'even' | 'odd';
  };
  characterSet: string[];
  defaultFont: string;
  features: string[];
  sampleStyles: string[];
}

const TYPEWRITER_MODELS: TypewriterModel[] = [
  {
    id: 'ibm-selectric',
    name: 'IBM Selectric',
    manufacturer: 'IBM',
    year: 1961,
    serialPortConfig: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
    characterSet: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    defaultFont: 'Courier',
    features: ['serif', 'fixed-width', 'bold-stroke'],
    sampleStyles: []
  },
  {
    id: 'olympia-smg',
    name: 'Olympia SMG',
    manufacturer: 'Olympia',
    year: 1970,
    serialPortConfig: { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'even' },
    characterSet: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    defaultFont: 'Pica',
    features: ['serif', 'narrow-width', 'light-stroke'],
    sampleStyles: []
  },
  {
    id: 'underwood-5',
    name: 'Underwood No. 5',
    manufacturer: 'Underwood',
    year: 1920,
    serialPortConfig: { baudRate: 4800, dataBits: 7, stopBits: 2, parity: 'odd' },
    characterSet: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    defaultFont: 'Elite',
    features: ['serif', 'condensed', 'heavy-stroke'],
    sampleStyles: []
  },
  {
    id: 'remington-noiseless',
    name: 'Remington Noiseless',
    manufacturer: 'Remington',
    year: 1955,
    serialPortConfig: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
    characterSet: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    defaultFont: 'Script',
    features: ['sans-serif', 'proportional', 'light-stroke'],
    sampleStyles: []
  },
  {
    id: 'brother-gx',
    name: 'Brother GX Series',
    manufacturer: 'Brother',
    year: 1990,
    serialPortConfig: { baudRate: 38400, dataBits: 8, stopBits: 1, parity: 'none' },
    characterSet: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    defaultFont: 'Gothic',
    features: ['sans-serif', 'fixed-width', 'medium-stroke'],
    sampleStyles: []
  }
];

export class StyleComparisonModule extends EventEmitter {
  private styleDatabase: Map<string, CharacterStyle> = new Map();
  private modelDatabase: Map<string, TypewriterModel> = new Map();
  private dataPath: string;

  constructor(dataPath?: string) {
    super();
    this.dataPath = dataPath || path.join(process.cwd(), 'data', 'styles');
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      TYPEWRITER_MODELS.forEach(model => {
        this.modelDatabase.set(model.id, model);
      });
      this.emit('database-initialized', { modelCount: this.modelDatabase.size });
    } catch (error) {
      console.error('Failed to initialize style database:', error);
    }
  }

  addStyle(style: CharacterStyle): void {
    this.styleDatabase.set(style.id, style);
    this.emit('style-added', { styleId: style.id, character: style.character });
  }

  getStyle(styleId: string): CharacterStyle | undefined {
    return this.styleDatabase.get(styleId);
  }

  getAllStyles(): CharacterStyle[] {
    return Array.from(this.styleDatabase.values());
  }

  getStylesByModel(modelName: string): CharacterStyle[] {
    return Array.from(this.styleDatabase.values())
      .filter(s => s.typewriterModel.toLowerCase().includes(modelName.toLowerCase()));
  }

  getStylesByCharacter(character: string): CharacterStyle[] {
    return Array.from(this.styleDatabase.values())
      .filter(s => s.character === character);
  }

  compareStyles(style1: CharacterStyle, style2: CharacterStyle): StyleComparisonResult {
    const widthDiff = Math.abs(style1.features.width - style2.features.width);
    const heightDiff = Math.abs(style1.features.height - style2.features.height);
    const strokeWidthDiff = Math.abs(style1.features.strokeWidth - style2.features.strokeWidth);
    const aspectRatioDiff = Math.abs(style1.features.aspectRatio - style2.features.aspectRatio);
    const slantDiff = Math.abs(style1.features.slant - style2.features.slant);

    const widthScore = Math.max(0, 1 - widthDiff / Math.max(style1.features.width, 1));
    const heightScore = Math.max(0, 1 - heightDiff / Math.max(style1.features.height, 1));
    const strokeScore = Math.max(0, 1 - strokeWidthDiff / Math.max(style1.features.strokeWidth, 1));
    const aspectScore = Math.max(0, 1 - Math.abs(aspectRatioDiff));
    const serifScore = style1.features.serif === style2.features.serif ? 1 : 0;
    const slantScore = Math.max(0, 1 - slantDiff / 45);

    const similarity = Math.round((
      widthScore * 0.25 +
      heightScore * 0.25 +
      strokeScore * 0.2 +
      aspectScore * 0.15 +
      serifScore * 0.1 +
      slantScore * 0.05
    ) * 100);

    const avgWidth = (style1.features.width + style2.features.width) / 2;
    let sizeCategory: 'small' | 'medium' | 'large' = 'medium';
    if (avgWidth < 8) sizeCategory = 'small';
    else if (avgWidth > 12) sizeCategory = 'large';

    const fontFamilies = ['Courier', 'Pica', 'Elite', 'Script', 'Gothic'];
    const serifFonts = ['Courier', 'Pica', 'Elite'];
    const fontFamily = style1.features.serif 
      ? serifFonts[Math.floor(Math.random() * serifFonts.length)]
      : fontFamilies[Math.floor(Math.random() * fontFamilies.length)];

    const recommendations: string[] = [];
    if (similarity > 90) {
      recommendations.push('两款打字机字体高度相似，可能使用同款字球');
    } else if (similarity > 70) {
      recommendations.push('字体特征相似，可能为同系列型号');
    } else {
      recommendations.push('字体差异较大，为不同型号打字机');
    }

    if (widthDiff > 2) recommendations.push('字符宽度差异显著');
    if (strokeWidthDiff > 1) recommendations.push('笔画粗细差异明显');
    if (style1.features.serif !== style2.features.serif) recommendations.push('衬线特征不同');

    return {
      similarity,
      featureDifferences: {
        width: widthDiff,
        height: heightDiff,
        strokeWidth: strokeWidthDiff,
        aspectRatio: aspectRatioDiff,
        slant: slantDiff
      },
      matchDetails: {
        serifMatch: style1.features.serif === style2.features.serif,
        sizeCategory,
        fontFamily
      },
      recommendations
    };
  }

  batchCompare(
    sourceStyles: CharacterStyle[],
    targetStyles: CharacterStyle[]
  ): Array<{
    sourceId: string;
    targetId: string;
    character: string;
    similarity: number;
  }> {
    const results: Array<{
      sourceId: string;
      targetId: string;
      character: string;
      similarity: number;
    }> = [];

    for (const source of sourceStyles) {
      for (const target of targetStyles) {
        if (source.character === target.character) {
          const comparison = this.compareStyles(source, target);
          results.push({
            sourceId: source.id,
            targetId: target.id,
            character: source.character,
            similarity: comparison.similarity
          });
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  findMatchingModel(
    sampleStyles: CharacterStyle[],
    threshold: number = 70
  ): {
    model: TypewriterModel | null;
    confidence: number;
    matches: Array<{ modelId: string; modelName: string; similarity: number }>;
  } {
    const matches: Array<{ modelId: string; modelName: string; similarity: number }> = [];

    for (const model of this.modelDatabase.values()) {
      const modelStyles = this.getStylesByModel(model.name);
      
      if (modelStyles.length > 0 && sampleStyles.length > 0) {
        const comparisons = this.batchCompare(sampleStyles, modelStyles);
        const avgSimilarity = comparisons.reduce((sum, c) => sum + c.similarity, 0) / comparisons.length;
        
        if (avgSimilarity >= threshold) {
          matches.push({
            modelId: model.id,
            modelName: model.name,
            similarity: avgSimilarity
          });
        }
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);

    return {
      model: matches.length > 0 ? this.modelDatabase.get(matches[0].modelId) || null : null,
      confidence: matches.length > 0 ? matches[0].similarity : 0,
      matches
    };
  }

  generateStyleReport(style: CharacterStyle): string {
    const lines = [
      `字符样式报告: ${style.character}`,
      `打字机型号: ${style.typewriterModel}`,
      `采集时间: ${new Date(style.createdAt).toLocaleString()}`,
      '',
      '特征参数:',
      `  宽度: ${style.features.width.toFixed(2)}px`,
      `  高度: ${style.features.height.toFixed(2)}px`,
      `  笔画粗细: ${style.features.strokeWidth.toFixed(2)}px`,
      `  宽高比: ${style.features.aspectRatio.toFixed(3)}`,
      `  倾斜角度: ${style.features.slant.toFixed(1)}°`,
      `  衬线特征: ${style.features.serif ? '有' : '无'}`,
      '',
      `尺寸分类: ${style.features.width < 8 ? '小型' : style.features.width > 12 ? '大型' : '中型'}字体`,
      `字体风格: ${style.features.serif ? '衬线体' : '无衬线体'}`
    ];

    return lines.join('\n');
  }

  async saveStylesToFile(filePath: string): Promise<void> {
    const data = JSON.stringify(Array.from(this.styleDatabase.values()), null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
  }

  async loadStylesFromFile(filePath: string): Promise<number> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const styles = JSON.parse(data) as CharacterStyle[];
      styles.forEach(style => this.styleDatabase.set(style.id, style));
      return styles.length;
    } catch (error) {
      console.error('Failed to load styles:', error);
      return 0;
    }
  }

  getAllModels(): TypewriterModel[] {
    return Array.from(this.modelDatabase.values());
  }

  getModel(modelId: string): TypewriterModel | undefined {
    return this.modelDatabase.get(modelId);
  }

  extractFeaturesFromImage(
    imageData: string,
    character: string,
    typewriterModel: string
  ): CharacterStyle {
    const id = `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const baseWidth = 8 + Math.random() * 6;
    const baseHeight = 10 + Math.random() * 6;
    
    return {
      id,
      name: `${typewriterModel}_${character}`,
      typewriterModel,
      character,
      charCode: character.charCodeAt(0),
      features: {
        width: baseWidth,
        height: baseHeight,
        strokeWidth: 1.5 + Math.random(),
        serif: Math.random() > 0.3,
        slant: -5 + Math.random() * 10,
        aspectRatio: baseWidth / baseHeight,
        boundingBox: {
          left: Math.random() * 5,
          top: Math.random() * 5,
          right: baseWidth + Math.random() * 5,
          bottom: baseHeight + Math.random() * 5
        }
      },
      sampleImage: imageData,
      createdAt: Date.now()
    };
  }
}
