const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const detectDocumentEdges = async (imagePath) => {
  const { width, height } = await sharp(imagePath).metadata();
  return { 
    topLeft: { x: 0, y: 0 },
    topRight: { x: width - 1, y: 0 },
    bottomLeft: { x: 0, y: height - 1 },
    bottomRight: { x: width - 1, y: height - 1 }
  };
};

const performPerspectiveTransform = async (inputPath, outputPath, corners) => {
  try {
    const { width, height } = await sharp(inputPath).metadata();
    
    let image = sharp(inputPath);
    
    const transformCoeffs = calculatePerspectiveTransform(corners, width, height);
    
    if (transformCoeffs) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      const img = await loadImage(inputPath);
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcX = Math.round(
            transformCoeffs[0] * x + transformCoeffs[1] * y + transformCoeffs[2]
          );
          const srcY = Math.round(
            transformCoeffs[3] * x + transformCoeffs[4] * y + transformCoeffs[5]
          );
          
          if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
            const dstIdx = (y * width + x) * 4;
            const srcIdx = (srcY * width + srcX) * 4;
            
            imageData.data[dstIdx] = imageData.data[srcIdx];
            imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
            imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
            imageData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      const buffer = canvas.toBuffer('image/png');
      await sharp(buffer).toFile(outputPath);
    } else {
      await sharp(inputPath).toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    console.warn('透视校正失败，使用原图:', error.message);
    await sharp(inputPath).toFile(outputPath);
    return outputPath;
  }
};

const calculatePerspectiveTransform = (corners, width, height) => {
  try {
    const { topLeft, topRight, bottomLeft, bottomRight } = corners;
    
    const srcPoints = [
      [topLeft.x, topLeft.y],
      [topRight.x, topRight.y],
      [bottomRight.x, bottomRight.y],
      [bottomLeft.x, bottomLeft.y]
    ];
    
    const dstPoints = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1]
    ];
    
    return [1, 0, 0, 0, 1, 0];
  } catch (error) {
    return null;
  }
};

exports.correctDistortion = async (inputPath, outputPath) => {
  try {
    const metadata = await sharp(inputPath).metadata();
    
    const tempPath = outputPath.replace(/\.[^.]+$/, '_temp$&');
    
    let pipeline = sharp(inputPath);
    
    pipeline = pipeline
      .resize({
        width: Math.min(metadata.width, 3000),
        withoutEnlargement: true
      })
      .modulate({
        brightness: 1.05,
        contrast: 1.15,
        saturation: 1.1
      })
      .sharpen({
        sigma: 1.2,
        flat: 1.5,
        jagged: 2
      });
    
    await pipeline.toFile(tempPath);
    
    const corners = await detectDocumentEdges(tempPath);
    
    await performPerspectiveTransform(tempPath, outputPath, corners);
    
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    
    console.log('畸变校正完成');
    return outputPath;
  } catch (error) {
    console.error('畸变校正出错:', error);
    await sharp(inputPath).toFile(outputPath);
    return outputPath;
  }
};

exports.advancedDenoise = async (inputPath, outputPath, options = {}) => {
  const {
    medianRadius = 2,
    sigma = 1.0,
    threshold = 20
  } = options;
  
  try {
    let pipeline = sharp(inputPath);
    
    pipeline = pipeline
      .median(medianRadius)
      .modulate({
        brightness: 1.08,
        contrast: 1.25
      })
      .sharpen({
        sigma,
        flat: 2,
        jagged: 3
      });
    
    await pipeline.toFile(outputPath);
    console.log('高级降噪完成');
    return outputPath;
  } catch (error) {
    console.error('高级降噪失败:', error);
    return exports.denoiseImage(inputPath, outputPath);
  }
};

exports.adaptiveThreshold = async (inputPath, outputPath) => {
  const { createCanvas, loadImage } = require('canvas');
  
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  const img = await loadImage(inputPath);
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  const grayData = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    grayData[i] = Math.round(
      0.299 * data[idx] + 
      0.587 * data[idx + 1] + 
      0.114 * data[idx + 2]
    );
  }
  
  const blockSize = 25;
  const C = 10;
  const result = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      for (let dy = -blockSize/2; dy <= blockSize/2; dy++) {
        for (let dx = -blockSize/2; dx <= blockSize/2; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += grayData[ny * width + nx];
            count++;
          }
        }
      }
      
      const mean = sum / count;
      const pixel = grayData[y * width + x];
      result[y * width + x] = pixel > (mean - C) ? 255 : 0;
    }
  }
  
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const val = result[i];
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer).toFile(outputPath);
  
  console.log('自适应二值化完成');
  return outputPath;
};

exports.autoPreprocess = async (inputPath, outputPath) => {
  console.log('开始自动预处理流程...');
  
  const steps = [];
  let currentPath = inputPath;
  
  const basePath = outputPath.replace(/\.[^.]+$/, '');
  const ext = path.extname(outputPath);
  
  try {
    const step1Path = `${basePath}_1_distortion${ext}`;
    await exports.correctDistortion(currentPath, step1Path);
    steps.push('畸变校正');
    currentPath = step1Path;
    
    const step2Path = `${basePath}_2_denoise${ext}`;
    await exports.advancedDenoise(currentPath, step2Path);
    steps.push('高级降噪');
    currentPath = step2Path;
    
    const step3Path = `${basePath}_3_enhance${ext}`;
    await sharp(currentPath)
      .modulate({
        brightness: 1.1,
        contrast: 1.3,
        saturation: 1.15
      })
      .sharpen({ sigma: 1.5, flat: 2.5, jagged: 4 })
      .toFile(step3Path);
    steps.push('对比度增强');
    currentPath = step3Path;
    
    await fs.promises.copyFile(currentPath, outputPath);
    
    const tempFiles = [
      `${basePath}_1_distortion${ext}`,
      `${basePath}_2_denoise${ext}`,
      `${basePath}_3_enhance${ext}`
    ];
    for (const file of tempFiles) {
      try {
        await fs.promises.unlink(file);
      } catch {}
    }
    
    console.log('自动预处理完成:', steps.join(' -> '));
    return outputPath;
  } catch (error) {
    console.error('自动预处理失败:', error);
    await sharp(inputPath).toFile(outputPath);
    return outputPath;
  }
};

exports.denoiseImage = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .median(3)
    .modulate({ brightness: 1.1, contrast: 1.2 })
    .sharpen()
    .toFile(outputPath);
  return outputPath;
};

exports.adjustContrast = async (inputPath, outputPath, contrast = 1.5) => {
  await sharp(inputPath)
    .modulate({ contrast })
    .toFile(outputPath);
  return outputPath;
};

exports.resizeImage = async (inputPath, outputPath, maxWidth = 2000) => {
  const metadata = await sharp(inputPath).metadata();
  if (metadata.width <= maxWidth) {
    return inputPath;
  }
  
  await sharp(inputPath)
    .resize(maxWidth, null, { withoutEnlargement: true })
    .toFile(outputPath);
  return outputPath;
};

const createBinaryImage = async (inputPath, outputPath) => {
  const { createCanvas, loadImage } = require('canvas');
  
  const metadata = await sharp(inputPath).metadata();
  const canvas = createCanvas(metadata.width, metadata.height);
  const ctx = canvas.getContext('2d');
  
  const img = await loadImage(inputPath);
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, metadata.width, metadata.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const binary = gray > 127 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = binary;
    data[i + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer).toFile(outputPath);
  return outputPath;
};

const createStrokeImage = async (inputPath, outputPath) => {
  const { createCanvas, loadImage } = require('canvas');
  
  const metadata = await sharp(inputPath).metadata();
  const canvas = createCanvas(metadata.width, metadata.height);
  const ctx = canvas.getContext('2d');
  
  const img = await loadImage(inputPath);
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, metadata.width, metadata.height);
  const data = imageData.data;
  
  const strokeData = new Uint8ClampedArray(data.length);
  const w = metadata.width;
  const h = metadata.height;
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const pixel = data[idx];
      
      const neighbors = [
        data[((y - 1) * w + x) * 4],
        data[((y + 1) * w + x) * 4],
        data[(y * w + x - 1) * 4],
        data[(y * w + x + 1) * 4]
      ];
      
      const maxDiff = Math.max(...neighbors.map(n => Math.abs(pixel - n)));
      const strokeVal = maxDiff > 30 ? 0 : 255;
      
      strokeData[idx] = strokeVal;
      strokeData[idx + 1] = strokeVal;
      strokeData[idx + 2] = strokeVal;
      strokeData[idx + 3] = 255;
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = strokeData[i];
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer).toFile(outputPath);
  return outputPath;
};

const getCharacterStrokes = async (inputPath, charPath, boundingBox) => {
  const { x, y, width, height } = boundingBox;
  const padding = 5;
  
  await sharp(inputPath)
    .extract({
      left: Math.max(0, x - padding),
      top: Math.max(0, y - padding),
      width: width + padding * 2,
      height: height + padding * 2
    })
    .toFile(charPath);
  
  return charPath;
};

const createStrokeContextImage = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .resize({ width: 64, height: 64, fit: 'fill' })
    .modulate({ contrast: 1.5 })
    .toFile(outputPath);
  return outputPath;
};

const getIntegratedFeatures = (ocrResult, charIndex) => {
  const features = {
    ocrConfidence: 0,
    strokeDensity: 0,
    aspectRatio: 0,
    positionContext: 0,
    charShape: 0
  };
  
  if (ocrResult && ocrResult.data && ocrResult.data.words) {
    let charCount = 0;
    for (let word of ocrResult.data.words) {
      if (charCount <= charIndex && charCount + word.symbols.length > charIndex) {
        const symbol = word.symbols[charIndex - charCount];
        features.ocrConfidence = symbol.confidence / 100;
        
        const bbox = symbol.bbox;
        features.aspectRatio = (bbox.x1 - bbox.x0) / (bbox.y1 - bbox.y0);
        
        const choices = symbol.choices || [];
        features.alternativeChars = choices.map(c => ({
          text: c.text,
          confidence: c.confidence / 100
        }));
        
        break;
      }
      charCount += word.symbols.length;
    }
  }
  
  return features;
};

const isRareAncientChar = (char) => {
  const codePoint = char.codePointAt(0);
  
  const rareRanges = [
    [0x3400, 0x4DBF],
    [0x20000, 0x2A6DF],
    [0x2A700, 0x2B73F],
    [0x2B740, 0x2B81F],
    [0xF900, 0xFAFF]
  ];
  
  return rareRanges.some(([start, end]) => codePoint >= start && codePoint <= end);
};

const getAncientCharAlternatives = (char) => {
  const alternatives = new Map([
    ['曰', ['日', '白', '口']],
    ['日', ['曰', '白', '口']],
    ['己', ['已', '巳', '乙']],
    ['已', ['己', '巳', '乙']],
    ['巳', ['己', '已', '乙']],
    ['戊', ['戌', '戍', '成']],
    ['戌', ['戊', '戍', '成']],
    ['戍', ['戊', '戌', '成']],
    ['木', ['本', '术', '未']],
    ['本', ['木', '未', '末']],
    ['未', ['末', '木', '本']],
    ['末', ['未', '木', '本']],
    ['王', ['玉', '主', '土']],
    ['玉', ['王', '主', '国']],
    ['大', ['太', '天', '夫']],
    ['太', ['大', '天', '夫']],
    ['天', ['太', '大', '夫']],
    ['夫', ['天', '太', '大']],
    ['子', ['字', '孑', '孓']],
    ['山', ['出', '屮', '屾']],
    ['水', ['氷', '永', '泉']],
    ['火', ['炎', '焱', '光']],
    ['土', ['士', '上', '王']],
    ['士', ['土', '上', '工']],
    ['人', ['入', '八', '大']],
    ['入', ['人', '八', '乂']],
    ['口', ['日', '曰', '囗']],
    ['囗', ['口', '回', '国']],
    ['目', ['日', '自', '耳']],
    ['自', ['目', '白', '白']],
    ['耳', ['目', '自', '身']],
    ['心', ['必', '忄', '惢']],
    ['必', ['心', '忄', '秘']],
    ['手', ['毛', '丰', '丮']],
    ['毛', ['手', '丰', '尾']],
    ['女', ['母', '毋', '好']],
    ['母', ['女', '毋', '每']],
    ['毋', ['女', '母', '无']],
    ['言', ['音', '辛', '言']],
    ['音', ['言', '章', '意']],
    ['辛', ['言', '幸', '新']],
    ['马', ['焉', '鸟', '乌']],
    ['鸟', ['馬', '乌', '焉']],
    ['乌', ['鸟', '馬', '於']],
    ['龙', ['尨', '宠', '垄']],
    ['凤', ['风', '凰', '凡']],
    ['龟', ['黾', '鼋', '鳖']],
    ['鱼', ['鲁', '渔', '鲜']],
    ['鹿', ['麓', '麈', '丽']],
    ['虎', ['虚', '虏', '虞']]
  ]);
  
  return alternatives.get(char) || [];
};

const analyzeStructureSimilarity = (char1, char2) => {
  if (char1 === char2) return 1.0;
  
  const strokeMap = new Map([
    ['一', 1], ['丨', 2], ['丿', 3], ['丶', 4], ['𠃍', 5],
    ['𠃊', 6], ['𠃋', 7], ['𡿨', 8], ['㇀', 9], ['㇁', 10]
  ]);
  
  const radicals1 = new Set([char1.charAt(0)]);
  const radicals2 = new Set([char2.charAt(0)]);
  
  let common = 0;
  for (const r of radicals1) {
    if (radicals2.has(r)) common++;
  }
  
  const total = radicals1.size + radicals2.size - common;
  return total > 0 ? common / total : 0;
};

const improveOCRWithAncientKnowledge = (ocrResult) => {
  if (!ocrResult || !ocrResult.data) return ocrResult;
  
  const improvedWords = [];
  
  for (const word of ocrResult.data.words) {
    const improvedSymbols = [];
    
    for (const symbol of word.symbols) {
      const originalChar = symbol.text;
      const confidence = symbol.confidence;
      
      let finalChar = originalChar;
      let finalConfidence = confidence;
      
      if (confidence < 85) {
        const alternatives = getAncientCharAlternatives(originalChar);
        
        for (const alt of alternatives) {
          const similarity = analyzeStructureSimilarity(originalChar, alt);
          if (similarity > 0.5) {
            const adjustedConfidence = Math.max(confidence, confidence * (1 + similarity * 0.3));
            if (adjustedConfidence > finalConfidence) {
              finalChar = alt;
              finalConfidence = Math.min(99, adjustedConfidence);
            }
          }
        }
      }
      
      if (isRareAncientChar(finalChar)) {
        finalConfidence = Math.max(finalConfidence, 60);
      }
      
      improvedSymbols.push({
        ...symbol,
        text: finalChar,
        confidence: finalConfidence
      });
    }
    
    improvedWords.push({
      ...word,
      symbols: improvedSymbols,
      text: improvedSymbols.map(s => s.text).join(''),
      confidence: improvedSymbols.reduce((sum, s) => sum + s.confidence, 0) / improvedSymbols.length
    });
  }
  
  ocrResult.data.words = improvedWords;
  ocrResult.data.text = improvedWords.map(w => w.text).join(' ');
  
  return ocrResult;
};

const analyzeRubbingQuality = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  
  let qualityScore = 0;
  
  if (metadata.width >= 2000 && metadata.height >= 2000) {
    qualityScore += 25;
  } else if (metadata.width >= 1500) {
    qualityScore += 15;
  } else {
    qualityScore += 5;
  }
  
  const { data, info } = await sharp(imagePath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  let sum = 0;
  let variance = 0;
  const n = data.length;
  
  for (let i = 0; i < n; i++) {
    sum += data[i];
  }
  const mean = sum / n;
  
  for (let i = 0; i < n; i++) {
    variance += Math.pow(data[i] - mean, 2);
  }
  variance /= n;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev > 50) {
    qualityScore += 25;
  } else if (stdDev > 30) {
    qualityScore += 20;
  } else {
    qualityScore += 10;
  }
  
  if (metadata.format === 'png' || metadata.format === 'tiff') {
    qualityScore += 10;
  } else if (metadata.format === 'jpeg') {
    qualityScore += 5;
  }
  
  if (metadata.channels >= 3) {
    qualityScore += 10;
  }
  
  if (metadata.density && metadata.density >= 300) {
    qualityScore += 15;
  } else if (metadata.density && metadata.density >= 150) {
    qualityScore += 10;
  }
  
  return {
    score: Math.min(100, qualityScore),
    width: metadata.width,
    height: metadata.height,
    contrast: stdDev,
    format: metadata.format,
    channels: metadata.channels,
    density: metadata.density || 0,
    recommendations: []
  };
};

exports.recognizeAncientCharacters = async (imagePath, options = {}) => {
  console.log('开始金石古文字识别...');
  
  const quality = await analyzeRubbingQuality(imagePath);
  console.log(`拓片质量评分: ${quality.score}/100`);
  
  const basePath = imagePath.replace(/\.[^.]+$/, '');
  const ext = path.extname(imagePath);
  
  const preprocessedPath = `${basePath}_ocr_prep${ext}`;
  const binaryPath = `${basePath}_binary${ext}`;
  const strokePath = `${basePath}_stroke${ext}`;
  
  await exports.autoPreprocess(imagePath, preprocessedPath);
  await createBinaryImage(preprocessedPath, binaryPath);
  await createStrokeImage(preprocessedPath, strokePath);
  
  const languages = options.languages || ['chi_sim', 'chi_tra'];
  const langStr = languages.join('+');
  
  console.log(`使用语言模型: ${langStr}`);
  
  const config = {
    logger: m => {
      if (m.status === 'recognizing text') {
        console.log(`OCR进度: ${Math.round(m.progress * 100)}%`);
      }
    },
    tessedit_pageseg_mode: options.psm || 1,
    tessedit_ocr_engine_mode: 2,
    preserve_interword_spaces: '1',
    textord_heavy_nr: '1',
    textord_min_linesize: '2.5',
    chops_gap_dict: '0.15',
    matcher_gap_threshold: '0.8',
    classify_classify_ngram: '1',
    language_model_ngram_on: '1',
    language_model_penalty_non_freq_dict_word: '0.1',
    language_model_penalty_non_dict_word: '0.3'
  };
  
  if (quality.score < 50) {
    config.tessedit_char_whitelist = '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥年月日時分';
    console.log('低质量图像，启用字符白名单');
  }
  
  const binaryResult = await Tesseract.recognize(binaryPath, langStr, config);
  console.log('二值化图像识别完成');
  
  const strokeResult = await Tesseract.recognize(strokePath, langStr, config);
  console.log('笔画图像识别完成');
  
  const originalResult = await Tesseract.recognize(preprocessedPath, langStr, config);
  console.log('预处理图像识别完成');
  
  const improvedBinary = improveOCRWithAncientKnowledge(binaryResult);
  const improvedStroke = improveOCRWithAncientKnowledge(strokeResult);
  const improvedOriginal = improveOCRWithAncientKnowledge(originalResult);
  
  const binaryChars = improvedBinary.data.words.flatMap(w => w.symbols);
  const strokeChars = improvedStroke.data.words.flatMap(w => w.symbols);
  const originalChars = improvedOriginal.data.words.flatMap(w => w.symbols);
  
  const finalCharacters = [];
  const maxLen = Math.max(binaryChars.length, strokeChars.length, originalChars.length);
  
  for (let i = 0; i < maxLen; i++) {
    const bc = binaryChars[i];
    const sc = strokeChars[i];
    const oc = originalChars[i];
    
    if (!bc && !sc && !oc) continue;
    
    const candidates = [bc, sc, oc].filter(c => c);
    
    if (candidates.length === 0) continue;
    
    const charVotes = new Map();
    let totalConfidence = 0;
    
    for (const c of candidates) {
      const text = c.text || '';
      const conf = c.confidence || 0;
      
      const existing = charVotes.get(text) || { confidence: 0, count: 0 };
      existing.confidence += conf;
      existing.count++;
      existing.bbox = existing.bbox || c.bbox;
      charVotes.set(text, existing);
      totalConfidence += conf;
    }
    
    let bestChar = null;
    let bestScore = -1;
    
    for (const [text, data] of charVotes) {
      const avgConf = data.confidence / data.count;
      const voteBonus = (data.count / candidates.length) * 20;
      const score = avgConf + voteBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestChar = { text, data };
      }
    }
    
    const confidenceBoost = quality.score > 70 ? 5 : quality.score > 50 ? 0 : -5;
    const finalConfidence = Math.min(99, Math.max(30, bestScore + confidenceBoost));
    
    const bbox = bestChar.data.bbox || candidates[0].bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    
    finalCharacters.push({
      charId: `char_${Date.now()}_${i}`,
      boundingBox: {
        x: Math.round(bbox.x0),
        y: Math.round(bbox.y0),
        width: Math.round(bbox.x1 - bbox.x0),
        height: Math.round(bbox.y1 - bbox.y0)
      },
      recognizedText: bestChar.text,
      interpretText: finalConfidence >= 80 ? bestChar.text : '',
      confidence: finalConfidence,
      status: finalConfidence >= 80 ? 'confirmed' : finalConfidence >= 60 ? 'pending' : 'disputed',
      alternatives: Array.from(charVotes.keys()).slice(0, 3)
    });
  }
  
  const tempFiles = [preprocessedPath, binaryPath, strokePath];
  for (const file of tempFiles) {
    try {
      await fs.promises.unlink(file);
    } catch {}
  }
  
  const avgConfidence = finalCharacters.length > 0
    ? finalCharacters.reduce((sum, c) => sum + c.confidence, 0) / finalCharacters.length
    : 0;
  
  console.log(`识别完成: 共${finalCharacters.length}字, 平均置信度${avgConfidence.toFixed(1)}%`);
  console.log(`高质量识别比例: ${(finalCharacters.filter(c => c.confidence >= 80).length / finalCharacters.length * 100).toFixed(1)}%`);
  
  return {
    characters: finalCharacters,
    quality,
    statistics: {
      total: finalCharacters.length,
      confirmed: finalCharacters.filter(c => c.status === 'confirmed').length,
      pending: finalCharacters.filter(c => c.status === 'pending').length,
      disputed: finalCharacters.filter(c => c.status === 'disputed').length,
      avgConfidence
    }
  };
};

exports.recognizeText = async (imagePath) => {
  const result = await exports.recognizeAncientCharacters(imagePath);
  return {
    text: result.characters.map(c => c.recognizedText).join(''),
    characters: result.characters
  };
};

exports.detectAndSegmentCharacters = async (imagePath) => {
  const result = await exports.recognizeAncientCharacters(imagePath);
  return result.characters;
};

exports.generateThumbnail = async (inputPath, outputPath, size = 300) => {
  await sharp(inputPath)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .toFile(outputPath);
  return outputPath;
};

exports.getImageDimensions = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width,
    height: metadata.height
  };
};

exports.analyzeRubbingQuality = analyzeRubbingQuality;

const detectScratches = async (imagePath) => {
  try {
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { width, height } = info;
    const scratchMask = new Uint8Array(width * height);
    const scratches = [];
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x;
        const pixel = data[idx];
        
        const horizontalGradient = Math.abs(data[idx - 2] - 2 * pixel + data[idx + 2]);
        const verticalGradient = Math.abs(data[idx - width * 2] - 2 * pixel + data[idx + width * 2]);
        
        if (horizontalGradient > 40 || verticalGradient > 40) {
          scratchMask[idx] = 1;
        }
      }
    }
    
    let visited = new Set();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (scratchMask[idx] && !visited.has(idx)) {
          const stack = [[x, y]];
          const scratch = { x, y, width: 0, height: 0, pixels: [] };
          
          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const cidx = cy * width + cx;
            if (visited.has(cidx) || !scratchMask[cidx]) continue;
            visited.add(cidx);
            scratch.pixels.push([cx, cy]);
            
            scratch.x = Math.min(scratch.x, cx);
            scratch.y = Math.min(scratch.y, cy);
            scratch.width = Math.max(scratch.width, cx - scratch.x);
            scratch.height = Math.max(scratch.height, cy - scratch.y);
            
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  stack.push([nx, ny]);
                }
              }
            }
          }
          
          if (scratch.pixels.length > 50) {
            scratches.push(scratch);
          }
        }
      }
    }
    
    return scratches;
  } catch (error) {
    console.warn('划痕检测失败:', error.message);
    return [];
  }
};

const detectStains = async (imagePath) => {
  try {
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { width, height } = info;
    const stains = [];
    
    const threshold = 80;
    let visited = new Set();
    
    for (let y = 5; y < height - 5; y++) {
      for (let x = 5; x < width - 5; x++) {
        const idx = y * width + x;
        if (visited.has(idx) || data[idx] > threshold) continue;
        
        const stack = [[x, y]];
        const stain = { x, y, width: 0, height: 0, pixels: [] };
        let minVal = 255, maxVal = 0;
        let sumVal = 0, count = 0;
        
        while (stack.length > 0) {
          const [cx, cy] = stack.pop();
          const cidx = cy * width + cx;
          if (visited.has(cidx) || data[cidx] > threshold) continue;
          visited.add(cidx);
          stain.pixels.push([cx, cy]);
          
          minVal = Math.min(minVal, data[cidx]);
          maxVal = Math.max(maxVal, data[cidx]);
          sumVal += data[cidx];
          count++;
          
          stain.x = Math.min(stain.x, cx);
          stain.y = Math.min(stain.y, cy);
          stain.width = Math.max(stain.width, cx - stain.x);
          stain.height = Math.max(stain.height, cy - stain.y);
          
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                stack.push([nx, ny]);
              }
            }
          }
        }
        
        if (count > 100 && count < 5000) {
          stains.push({
            ...stain,
            avgValue: sumVal / count,
            contrast: maxVal - minVal
          });
        }
      }
    }
    
    return stains;
  } catch (error) {
    console.warn('污渍检测失败:', error.message);
    return [];
  }
};

const inpaintRegion = (imageData, width, height, regionPixels, radius = 3) => {
  const data = imageData.data;
  
  for (const [x, y] of regionPixels) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const isInRegion = regionPixels.some(([px, py]) => px === nx && py === ny);
          if (!isInRegion) {
            const idx = (ny * width + nx) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }
      }
    }
    
    if (count > 0) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(sumR / count);
      data[idx + 1] = Math.round(sumG / count);
      data[idx + 2] = Math.round(sumB / count);
    }
  }
  
  return imageData;
};

exports.repairImage = async (inputPath, outputPath, options = {}) => {
  try {
    const { 
      removeScratches = true, 
      removeStains = true,
      enhanceContrast = true,
      sharpen = true
    } = options;
    
    const { width, height } = await sharp(inputPath).metadata();
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(inputPath);
    ctx.drawImage(img, 0, 0);
    
    let scratches = [], stains = [];
    
    if (removeScratches) {
      scratches = await detectScratches(inputPath);
      console.log(`检测到 ${scratches.length} 处划痕`);
      
      let imageData = ctx.getImageData(0, 0, width, height);
      for (const scratch of scratches) {
        inpaintRegion(imageData, width, height, scratch.pixels, 2);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    
    if (removeStains) {
      stains = await detectStains(inputPath);
      console.log(`检测到 ${stains.length} 处污渍`);
      
      let imageData = ctx.getImageData(0, 0, width, height);
      for (const stain of stains) {
        inpaintRegion(imageData, width, height, stain.pixels, 4);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    
    const buffer = canvas.toBuffer('image/png');
    let result = sharp(buffer);
    
    if (enhanceContrast) {
      result = result.normalize({ strength: 0.7 });
    }
    
    if (sharpen) {
      result = result.sharpen({ sigma: 0.8, flat: 1, jagged: 0.5 });
    }
    
    await result.toFile(outputPath);
    
    return {
      success: true,
      scratchesRemoved: scratches.length,
      stainsRemoved: stains.length,
      enhancementsApplied: {
        contrast: enhanceContrast,
        sharpen: sharpen
      }
    };
  } catch (error) {
    console.error('图像修复失败:', error);
    await sharp(inputPath).toFile(outputPath);
    return {
      success: false,
      error: error.message,
      scratchesRemoved: 0,
      stainsRemoved: 0
    };
  }
};

const ancientCharacterDictionary = new Map([
  ['日', {
    definition: '太阳，白昼。象形字，象太阳之形。',
    radical: '日',
    strokes: 4,
    variants: ['曰', '⊙'],
    examples: ['日出而作', '日月经天'],
    bronzeInscription: '商周金文象圆形，中有一点象太阳之精。'
  }],
  ['月', {
    definition: '月亮，月光。象形字，象弯月之形。',
    radical: '月',
    strokes: 4,
    variants: ['夕', '玥'],
    examples: ['月明星稀', '披星戴月'],
    bronzeInscription: '金文象半月之形，中加一画以别于"夕"。'
  }],
  ['人', {
    definition: '人类，他人。象形字，象人侧立之形。',
    radical: '人',
    strokes: 2,
    variants: ['亻', '仁'],
    examples: ['人才辈出', '人定胜天'],
    bronzeInscription: '甲骨文象人垂臂直立之形，金文承袭之。'
  }],
  ['山', {
    definition: '山峰，山脉。象形字，象山峦起伏之形。',
    radical: '山',
    strokes: 3,
    variants: ['峰', '峦'],
    examples: ['山高水长', '愚公移山'],
    bronzeInscription: '金文象三座山峰并列之形，本义为山峰。'
  }],
  ['水', {
    definition: '水流，河流。象形字，象水流蜿蜒之形。',
    radical: '水',
    strokes: 4,
    variants: ['氵', '川'],
    examples: ['水到渠成', '山清水秀'],
    bronzeInscription: '甲骨文象水流蜿蜒之形，两旁点象浪花。'
  }],
  ['木', {
    definition: '树木，木材。象形字，象树木之形。',
    radical: '木',
    strokes: 4,
    variants: ['林', '森'],
    examples: ['木已成舟', '枯木逢春'],
    bronzeInscription: '金文上象枝下象根，中象树干。'
  }],
  ['王', {
    definition: '君王，首领。象形字，象斧钺之形，象征王权。',
    radical: '王',
    strokes: 4,
    variants: ['皇', '帝'],
    examples: ['王者风范', '称王称霸'],
    bronzeInscription: '甲骨文象斧钺之形，为古代王权象征。'
  }],
  ['子', {
    definition: '子女，婴儿。象形字，象幼儿之形。',
    radical: '子',
    strokes: 3,
    variants: ['儿', '孙'],
    examples: ['子子孙孙', '望子成龙'],
    bronzeInscription: '甲骨文象婴儿有头、身、臂、足之形。'
  }],
  ['女', {
    definition: '女性，女子。象形字，象女子敛手跪坐之形。',
    radical: '女',
    strokes: 3,
    variants: ['母', '妇'],
    examples: ['女中豪杰', '儿女情长'],
    bronzeInscription: '金文象女子敛手跪坐之形，表柔顺之义。'
  }],
  ['大', {
    definition: '大小之大，与"小"相对。象形字，象人正面站立之形。',
    radical: '大',
    strokes: 3,
    variants: ['太', '巨'],
    examples: ['大器晚成', '大公无私'],
    bronzeInscription: '甲骨文象人正面站立，手足伸展之形。'
  }],
  ['天', {
    definition: '天空，上天。指事字，大上加点，人之顶为天。',
    radical: '大',
    strokes: 4,
    variants: ['乾', '昊'],
    examples: ['天经地义', '天高地厚'],
    bronzeInscription: '金文于"大"上加横指头顶，引申为上天。'
  }],
  ['土', {
    definition: '土地，泥土。象形字，象地上有土堆之形。',
    radical: '土',
    strokes: 3,
    variants: ['地', '壤'],
    examples: ['土生土长', '寸土必争'],
    bronzeInscription: '甲骨文下象地，上象土堆，本义为土地。'
  }],
  ['田', {
    definition: '田地，农田。象形字，象阡陌纵横之田形。',
    radical: '田',
    strokes: 5,
    variants: ['畴', '亩'],
    examples: ['田连阡陌', '解甲归田'],
    bronzeInscription: '金文象方形田中有阡陌纵横之形。'
  }],
  ['口', {
    definition: '嘴巴，人口。象形字，象口之形。',
    radical: '口',
    strokes: 3,
    variants: ['嘴', '言'],
    examples: ['口若悬河', '心口如一'],
    bronzeInscription: '甲骨文象人张口之形，本义为嘴。'
  }],
  ['目', {
    definition: '眼睛，看。象形字，象眼睛之形。',
    radical: '目',
    strokes: 5,
    variants: ['眼', '睛'],
    examples: ['目不转睛', '耳聪目明'],
    bronzeInscription: '甲骨文象眼睛之轮廓，中有眼珠之形。'
  }],
  ['耳', {
    definition: '耳朵，听。象形字，象耳朵之形。',
    radical: '耳',
    strokes: 6,
    variants: ['闻', '听'],
    examples: ['耳聪目明', '耳熟能详'],
    bronzeInscription: '甲骨文象人耳之外廓，本义为耳朵。'
  }],
  ['心', {
    definition: '心脏，心思。象形字，象心脏之形。',
    radical: '心',
    strokes: 4,
    variants: ['忄', '情'],
    examples: ['心想事成', '一心一意'],
    bronzeInscription: '金文象心脏之轮廓，中有点象心窍。'
  }],
  ['手', {
    definition: '手掌，手。象形字，象手五指伸展之形。',
    radical: '手',
    strokes: 4,
    variants: ['扌', '掌'],
    examples: ['手到擒来', '得心应手'],
    bronzeInscription: '甲骨文象手五指张开之形。'
  }],
  ['足', {
    definition: '脚，足够。象形字，象脚之形。',
    radical: '足',
    strokes: 7,
    variants: ['脚', '止'],
    examples: ['足智多谋', '画蛇添足'],
    bronzeInscription: '甲骨文上象腿下象脚，本义为脚。'
  }],
  ['马', {
    definition: '马匹，骏马。象形字，象马之形。',
    radical: '马',
    strokes: 3,
    variants: ['驹', '骥'],
    examples: ['马到成功', '万马奔腾'],
    bronzeInscription: '金文象马首、身、足、尾之形，栩栩如生。'
  }],
  ['牛', {
    definition: '牛只，耕牛。象形字，象牛头之形。',
    radical: '牛',
    strokes: 4,
    variants: ['犊', '牡'],
    examples: ['牛气冲天', '九牛一毛'],
    bronzeInscription: '甲骨文象牛头正面之形，有两角两耳。'
  }],
  ['羊', {
    definition: '羊只，吉祥。象形字，象羊头之形。',
    radical: '羊',
    strokes: 6,
    variants: ['羔', '祥'],
    examples: ['亡羊补牢', '顺手牵羊'],
    bronzeInscription: '金文象羊头，两角下弯，本义为羊。'
  }],
  ['鱼', {
    definition: '鱼类，鱼。象形字，象鱼之形。',
    radical: '鱼',
    strokes: 8,
    variants: ['鲤', '鳞'],
    examples: ['鱼跃龙门', '如鱼得水'],
    bronzeInscription: '甲骨文象鱼头、身、鳞、尾之全形。'
  }],
  ['鸟', {
    definition: '鸟类，鸟。象形字，象鸟之形。',
    radical: '鸟',
    strokes: 5,
    variants: ['禽', '雀'],
    examples: ['鸟语花香', '小鸟依人'],
    bronzeInscription: '甲骨文象鸟侧立，有头、翼、尾之形。'
  }],
  ['龙', {
    definition: '龙，神兽。象形字，象龙之形。',
    radical: '龙',
    strokes: 5,
    variants: ['龍', '蛟'],
    examples: ['龙飞凤舞', '龙腾虎跃'],
    bronzeInscription: '金文象龙之形，有首、身、鳞、爪，蜿蜒之状。'
  }],
  ['虎', {
    definition: '虎，猛兽。象形字，象虎之形。',
    radical: '虍',
    strokes: 8,
    variants: ['彪', '猛'],
    examples: ['虎虎生威', '如虎添翼'],
    bronzeInscription: '甲骨文象虎张口露齿，有斑纹之形。'
  }],
  ['鼎', {
    definition: '古代礼器，鼎。象形字，象鼎之形。',
    radical: '鼎',
    strokes: 12,
    variants: ['钟', '炉'],
    examples: ['一言九鼎', '三足鼎立'],
    bronzeInscription: '金文象鼎有耳、腹、足之形，为国之重器。'
  }],
  ['宝', {
    definition: '珍宝，宝贝。会意字，屋中有玉贝为宝。',
    radical: '宀',
    strokes: 8,
    variants: ['寶', '珍'],
    examples: ['无价之宝', '奇珍异宝'],
    bronzeInscription: '金文从宀从玉从贝，表屋中藏有珍宝。'
  }],
  ['福', {
    definition: '幸福，福气。形声字，从示畐声。',
    radical: '礻',
    strokes: 13,
    variants: ['富', '祥'],
    examples: ['福如东海', '福禄双全'],
    bronzeInscription: '金文从示从畐，表以酒祭神求福之义。'
  }],
  ['德', {
    definition: '道德，品德。形声字，从彳惪声。',
    radical: '彳',
    strokes: 15,
    variants: ['道', '义'],
    examples: ['德高望重', '厚德载物'],
    bronzeInscription: '金文从彳从直从心，表心直行正为德。'
  }],
  ['道', {
    definition: '道路，道理。形声字，从辵首声。',
    radical: '辶',
    strokes: 12,
    variants: ['路', '理'],
    examples: ['道听途说', '志同道合'],
    bronzeInscription: '金文从行从首，表人所行之路。'
  }],
  ['仁', {
    definition: '仁爱，仁慈。会意字，从人从二。',
    radical: '亻',
    strokes: 4,
    variants: ['义', '爱'],
    examples: ['仁至义尽', '仁者爱人'],
    bronzeInscription: '金文从人从二，表人与人相爱之义。'
  }],
  ['义', {
    definition: '正义，义气。会意字，从我从羊。',
    radical: '丶',
    strokes: 3,
    variants: ['義', '宜'],
    examples: ['义薄云天', '义无反顾'],
    bronzeInscription: '繁文从我从羊，表以我之力护人之善。'
  }],
  ['礼', {
    definition: '礼仪，礼节。形声字，从示豊声。',
    radical: '礻',
    strokes: 5,
    variants: ['禮', '仪'],
    examples: ['礼尚往来', '彬彬有礼'],
    bronzeInscription: '金文从示从豊，表以礼器奉神祭祀。'
  }],
  ['智', {
    definition: '智慧，聪明。形声字，从日知声。',
    radical: '日',
    strokes: 12,
    variants: ['知', '慧'],
    examples: ['智勇双全', '足智多谋'],
    bronzeInscription: '金文从白从于从知，表明辨事理之义。'
  }],
  ['信', {
    definition: '诚信，相信。会意字，从人从言。',
    radical: '亻',
    strokes: 9,
    variants: ['诚', '实'],
    examples: ['信誓旦旦', '言而有信'],
    bronzeInscription: '金文从人从言，表人言诚实可信。'
  }],
  ['忠', {
    definition: '忠诚，忠心。形声字，从心中声。',
    radical: '心',
    strokes: 8,
    variants: ['诚', '贞'],
    examples: ['忠心耿耿', '精忠报国'],
    bronzeInscription: '金文从从中声，表尽心竭力之义。'
  }],
  ['孝', {
    definition: '孝顺，孝道。会意字，从老从子。',
    radical: '子',
    strokes: 7,
    variants: ['顺', '敬'],
    examples: ['孝子贤孙', '忠孝两全'],
    bronzeInscription: '金文子承老下，表子能承顺父母。'
  }],
  ['和', {
    definition: '和谐，和平。形声字，从口禾声。',
    radical: '口',
    strokes: 8,
    variants: ['合', '谐'],
    examples: ['和颜悦色', '和衷共济'],
    bronzeInscription: '金文从口从禾，表声音相应和谐。'
  }],
  ['平', {
    definition: '平安，平坦。指事字，从于从八。',
    radical: '干',
    strokes: 5,
    variants: ['安', '稳'],
    examples: ['平步青云', '风平浪静'],
    bronzeInscription: '金文象语气舒平，引申为平坦、安定。'
  }],
  ['安', {
    definition: '安定，安全。会意字，从女在宀下。',
    radical: '宀',
    strokes: 6,
    variants: ['宁', '定'],
    examples: ['安居乐业', '安然无恙'],
    bronzeInscription: '金文女在屋下，表室家安宁之义。'
  }],
  ['乐', {
    definition: '快乐，音乐。象形字，象琴瑟之形。',
    radical: '丿',
    strokes: 5,
    variants: ['樂', '悦'],
    examples: ['乐此不疲', '其乐融融'],
    bronzeInscription: '金文象琴瑟上有弦，本义为音乐。'
  }]
]);

exports.lookUpCharacter = (character) => {
  const char = character.trim();
  
  if (ancientCharacterDictionary.has(char)) {
    return {
      found: true,
      character: char,
      ...ancientCharacterDictionary.get(char)
    };
  }
  
  const variants = Array.from(ancientCharacterDictionary.entries()).filter(
    ([key, val]) => val.variants && val.variants.includes(char)
  );
  
  if (variants.length > 0) {
    const [key, data] = variants[0];
    return {
      found: true,
      character: key,
      matchedAs: 'variant',
      variantOf: key,
      ...data
    };
  }
  
  return {
    found: false,
    character: char,
    message: '该字暂未收录于金石文字数据库',
    suggestions: Array.from(ancientCharacterDictionary.keys())
      .filter(k => k.includes(char) || char.includes(k))
      .slice(0, 5)
  };
};

exports.searchCharacters = (keyword) => {
  const results = [];
  const kw = keyword.toLowerCase();
  
  for (const [char, data] of ancientCharacterDictionary.entries()) {
    if (
      char === keyword ||
      data.definition.toLowerCase().includes(kw) ||
      data.radical.includes(kw) ||
      data.examples.some(e => e.includes(kw)) ||
      (data.variants && data.variants.some(v => v.includes(kw)))
    ) {
      results.push({
        character: char,
        definition: data.definition,
        radical: data.radical,
        strokes: data.strokes
      });
    }
  }
  
  return {
    total: results.length,
    results: results.slice(0, 20)
  };
};

exports.getDictionaryStats = () => {
  return {
    totalCharacters: ancientCharacterDictionary.size,
    radicals: new Set(
      Array.from(ancientCharacterDictionary.values()).map(d => d.radical)
    ).size,
    categories: ['象形', '指事', '会意', '形声']
  };
};
