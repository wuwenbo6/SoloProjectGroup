import opentype from 'opentype.js';

interface ParseRequest {
  type: 'parse';
  fileData: ArrayBuffer;
  fileName: string;
}

interface SubsetRequest {
  type: 'subset';
  fileData: ArrayBuffer;
  fileName: string;
  characters: string;
  format: 'ttf' | 'woff2';
}

type WorkerRequest = ParseRequest | SubsetRequest;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { type } = event.data;
    
    if (type === 'parse') {
      const { fileData, fileName } = event.data;
      const font = opentype.parse(fileData);
      
      const glyphs = [];
      const charSet = new Set<string>();
      const maxGlyphs = 500;
      let processed = 0;

      for (let i = 0; i < font.glyphs.length && processed < maxGlyphs; i++) {
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
            processed++;
          }
        }
      }

      self.postMessage({
        success: true,
        data: {
          numGlyphs: font.numGlyphs,
          familyName: font.names.fontFamily?.en || 'Unknown',
          styleName: font.names.fontSubfamily?.en || 'Regular',
          unitsPerEm: font.unitsPerEm,
          ascender: font.ascender,
          descender: font.descender,
          glyphs: glyphs,
        },
      });
    } else if (type === 'subset') {
      const { fileData, characters, format } = event.data;
      const font = opentype.parse(fileData);
      
      const unicodes = characters.split('').map(c => c.codePointAt(0)!).filter(Boolean);
      const notdefGlyph = font.glyphs.get(0);
      const glyphSet = new Map<number, any>();
      glyphSet.set(0, notdefGlyph);

      for (const unicode of unicodes) {
        const glyph = font.charToGlyph(String.fromCodePoint(unicode));
        if (glyph && glyph.index !== undefined) {
          glyphSet.set(glyph.index, glyph);
        }
      }

      const subsetGlyphs = Array.from(glyphSet.values());
      const subsetFont = new opentype.Font({
        familyName: font.names.fontFamily?.en || 'Subset',
        styleName: font.names.fontSubfamily?.en || 'Regular',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        glyphs: subsetGlyphs,
      });

      let buffer: ArrayBuffer;
      let mimeType: string;

      if (format === 'woff2') {
        buffer = subsetFont.toArrayBuffer();
        mimeType = 'font/woff2';
      } else {
        buffer = subsetFont.toArrayBuffer();
        mimeType = 'font/ttf';
      }

      self.postMessage({
        success: true,
        data: {
          buffer,
          mimeType,
          glyphCount: subsetGlyphs.length,
        },
      });
    }
  } catch (error) {
    self.postMessage({
      success: false,
      error: (error as Error).message,
    });
  }
};
