export interface GlyphInfo {
  name: string;
  unicode: number;
  char: string;
  advanceWidth: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface KerningPair {
  left: number;
  right: number;
  value: number;
}

export interface OptimizedFonts {
  woff2?: string;
  otf?: string;
  sizes?: {
    original: number;
    woff2?: number;
    otf?: number;
  };
}

export interface FontMetadata {
  id: string;
  name: string;
  familyName: string;
  styleName: string;
  version: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  numGlyphs: number;
  glyphs: GlyphInfo[];
  kerningPairs: KerningPair[];
  fileName: string;
  fileSize: number;
  uploadDate: string;
  optimized?: OptimizedFonts;
  originalFormat: string;
}

export interface TypographyConfig {
  id?: string;
  name: string;
  fontId: string;
  text: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  customKernings: { [key: string]: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface CopyrightInfo {
  hasCopyright: boolean;
  copyrightText: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface ShareLink {
  id: string;
  shareCode: string;
  configId: string;
  views: number;
  createdAt: string;
  expiresAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  copyrightWarning?: string;
}
