import { Injectable, Logger } from '@nestjs/common';
import * as opentype from 'opentype.js';

interface CopyrightInfo {
  hasCopyright: boolean;
  copyrightText: string | null;
  trademark: string | null;
  manufacturer: string | null;
  designer: string | null;
  license: string | null;
  licenseURL: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

const COMMERCIAL_FONTS = new Set([
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
  'Garamond', 'Futura', 'Baskerville', 'Minion', 'Myriad',
  'Adobe', 'Monotype', 'Linotype', 'Microsoft', 'Apple'
]);

const OPEN_SOURCE_KEYWORDS = [
  'open source', 'opensource', 'free font', 'sil ofl',
  'gnu gpl', 'public domain', 'cc0', 'creative commons',
  'free for commercial', 'freeware', 'libre'
];

@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);

  analyzeFont(filePath: string): CopyrightInfo {
    try {
      const font = opentype.loadSync(filePath);
      return this.extractCopyrightInfo(font);
    } catch (error) {
      this.logger.error(`Failed to analyze font copyright: ${error.message}`);
      return {
        hasCopyright: true,
        copyrightText: null,
        trademark: null,
        manufacturer: null,
        designer: null,
        license: null,
        licenseURL: null,
        riskLevel: 'high',
        warnings: ['无法解析字体版权信息，请手动确认使用权限'],
      };
    }
  }

  private extractCopyrightInfo(font: opentype.Font): CopyrightInfo {
    const names = font.names;
    const warnings: string[] = [];

    const copyright = this.getNameValue(names, 'copyright');
    const trademark = this.getNameValue(names, 'trademark');
    const manufacturer = this.getNameValue(names, 'manufacturer');
    const designer = this.getNameValue(names, 'designer');
    const license = this.getNameValue(names, 'license');
    const licenseURL = this.getNameValue(names, 'licenseURL');

    const fullName = this.getNameValue(names, 'fullName') || '';
    const fontFamily = this.getNameValue(names, 'fontFamily') || '';

    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    const allText = `${copyright} ${trademark} ${manufacturer} ${designer} ${license} ${fullName} ${fontFamily}`.toLowerCase();

    if (license) {
      const isOpenSource = OPEN_SOURCE_KEYWORDS.some(keyword =>
        license.toLowerCase().includes(keyword)
      );
      if (isOpenSource) {
        riskLevel = 'low';
        warnings.push('该字体可能为开源字体，请确认具体授权条款');
      }
    }

    const isCommercial = COMMERCIAL_FONTS.some(name =>
      allText.includes(name.toLowerCase())
    );
    if (isCommercial) {
      riskLevel = 'high';
      warnings.push('检测到商业字体，请确保已获得使用授权');
    }

    if (!copyright && !license) {
      warnings.push('字体未包含明确的版权信息，使用前请确认授权');
    }

    if (allText.includes('all rights reserved') || allText.includes('©')) {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      warnings.push('字体包含版权保留声明');
    }

    const hasCopyright = !!(copyright || trademark || license);

    return {
      hasCopyright,
      copyrightText: copyright,
      trademark,
      manufacturer,
      designer,
      license,
      licenseURL,
      riskLevel,
      warnings,
    };
  }

  private getNameValue(names: any, key: string): string | null {
    if (!names) return null;
    const value = names[key];
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.en || value['en-US'] || Object.values(value)[0] || null;
    }
    return null;
  }

  generateCopyrightWarning(info: CopyrightInfo): string {
    const messages: string[] = [];

    if (info.riskLevel === 'high') {
      messages.push('⚠️ 【高风险】该字体可能受版权保护，请确保已获得合法使用授权！');
    } else if (info.riskLevel === 'medium') {
      messages.push('⚠️ 【中风险】该字体版权状态不明确，建议确认后使用');
    } else {
      messages.push('✅ 【低风险】该字体可能为开源/免费字体，请确认授权条款');
    }

    if (info.copyrightText) {
      messages.push(`版权声明: ${info.copyrightText.slice(0, 100)}${info.copyrightText.length > 100 ? '...' : ''}`);
    }

    if (info.designer) {
      messages.push(`设计师: ${info.designer}`);
    }

    if (info.manufacturer) {
      messages.push(`厂商: ${info.manufacturer}`);
    }

    if (info.license) {
      messages.push(`许可证: ${info.license}`);
    }

    info.warnings.forEach(w => messages.push(`- ${w}`));

    return messages.join('\n');
  }
}
