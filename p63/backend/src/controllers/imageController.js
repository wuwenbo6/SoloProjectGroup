const imageService = require('../services/imageService');
const exportService = require('../services/exportService');
const Rubbing = require('../models/Rubbing');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

exports.autoPreprocess = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const inputPath = path.join(__dirname, '../..', rubbing.originalImage);
    const outputFilename = `auto_processed_${Date.now()}_${path.basename(rubbing.originalImage)}`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    const quality = await imageService.analyzeRubbingQuality(inputPath);
    console.log(`图像质量分析: ${quality.score}/100`);

    await imageService.autoPreprocess(inputPath, outputPath);

    rubbing.processedImage = `/uploads/${outputFilename}`;
    rubbing.status = 'ready';
    
    const dimensions = await imageService.getImageDimensions(outputPath);
    rubbing.dimensions = dimensions;
    
    await rubbing.save();

    res.json({
      message: '自动预处理完成',
      processedImage: rubbing.processedImage,
      dimensions,
      quality
    });
  } catch (error) {
    console.error('自动预处理失败:', error);
    res.status(500).json({ message: '自动预处理失败', error: error.message });
  }
};

exports.processImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { operations } = req.body;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const inputPath = path.join(__dirname, '../..', rubbing.originalImage);
    let currentPath = inputPath;
    const outputFilename = `processed_${Date.now()}_${path.basename(rubbing.originalImage)}`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    for (const op of operations) {
      switch (op.type) {
        case 'denoise':
          await imageService.denoiseImage(currentPath, outputPath);
          currentPath = outputPath;
          break;
        case 'advancedDenoise':
          await imageService.advancedDenoise(currentPath, outputPath, op.options);
          currentPath = outputPath;
          break;
        case 'contrast':
          await imageService.adjustContrast(currentPath, outputPath, op.contrast);
          currentPath = outputPath;
          break;
        case 'resize':
          await imageService.resizeImage(currentPath, outputPath, op.maxWidth);
          currentPath = outputPath;
          break;
        case 'distortion':
          await imageService.correctDistortion(currentPath, outputPath);
          currentPath = outputPath;
          break;
        case 'threshold':
          await imageService.adaptiveThreshold(currentPath, outputPath);
          currentPath = outputPath;
          break;
      }
    }

    rubbing.processedImage = `/uploads/${outputFilename}`;
    rubbing.status = 'ready';
    
    const dimensions = await imageService.getImageDimensions(currentPath);
    rubbing.dimensions = dimensions;
    
    await rubbing.save();

    res.json({
      message: '图像处理成功',
      processedImage: rubbing.processedImage,
      dimensions
    });
  } catch (error) {
    res.status(500).json({ message: '图像处理失败', error: error.message });
  }
};

exports.recognizeCharacters = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const imagePath = rubbing.processedImage 
      ? path.join(__dirname, '../..', rubbing.processedImage)
      : path.join(__dirname, '../..', rubbing.originalImage);

    rubbing.status = 'processing';
    await rubbing.save();

    const result = await imageService.recognizeAncientCharacters(imagePath);
    
    rubbing.characters = result.characters;
    rubbing.status = 'ready';
    
    const confirmedChars = result.characters.filter(c => c.status === 'confirmed').length;
    rubbing.progress = result.characters.length > 0 
      ? Math.round((confirmedChars / result.characters.length) * 100) 
      : 0;
    
    await rubbing.save();

    res.json({
      message: '文字识别完成',
      characters: rubbing.characters,
      total: rubbing.characters.length,
      progress: rubbing.progress,
      quality: result.quality,
      statistics: result.statistics
    });
  } catch (error) {
    console.error('文字识别失败:', error);
    const rubbing = await Rubbing.findById(id);
    if (rubbing) {
      rubbing.status = 'ready';
      await rubbing.save();
    }
    res.status(500).json({ message: '文字识别失败', error: error.message });
  }
};

exports.getCharacterImage = async (req, res) => {
  try {
    const { id, charId } = req.params;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const character = rubbing.characters.find(c => c.charId === charId);
    if (!character) {
      return res.status(404).json({ message: '文字不存在' });
    }

    const imagePath = rubbing.processedImage 
      ? path.join(__dirname, '../..', rubbing.processedImage)
      : path.join(__dirname, '../..', rubbing.originalImage);

    const outputFilename = `char_${charId}_${Date.now()}.png`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    const { x, y, width, height } = character.boundingBox;
    const padding = 10;
    
    await sharp(imagePath)
      .extract({
        left: Math.max(0, x - padding),
        top: Math.max(0, y - padding),
        width: width + padding * 2,
        height: height + padding * 2
      })
      .resize(100, 100, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .toFile(outputPath);

    res.json({
      characterImage: `/uploads/${outputFilename}`,
      boundingBox: character.boundingBox,
      alternatives: character.alternatives
    });
  } catch (error) {
    res.status(500).json({ message: '提取文字图像失败', error: error.message });
  }
};

exports.analyzeQuality = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const imagePath = path.join(__dirname, '../..', rubbing.originalImage);
    const quality = await imageService.analyzeRubbingQuality(imagePath);

    res.json({
      quality,
      recommendations: [
        quality.score >= 80 ? '图像质量优秀，可以直接开始识别' : 
        quality.score >= 60 ? '图像质量良好，建议先进行预处理' :
        quality.score >= 40 ? '图像质量一般，建议先进行降噪和增强处理' :
        '图像质量较差，建议重新扫描或拍摄更高分辨率的图像',
        quality.width < 1500 ? '建议使用分辨率不低于2000像素的图像' : '分辨率良好',
        quality.contrast < 30 ? '图像对比度较低，建议调整对比度' : '对比度良好'
      ]
    });
  } catch (error) {
    res.status(500).json({ message: '质量分析失败', error: error.message });
  }
};

exports.repairImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { removeScratches = true, removeStains = true, enhanceContrast = true, sharpen = true } = req.body;
    
    const rubbing = await Rubbing.findById(id);
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const inputPath = path.join(__dirname, '../..', rubbing.processedImage || rubbing.originalImage);
    const timestamp = Date.now();
    const outputFilename = `repaired_${timestamp}_${path.basename(inputPath)}`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    const result = await imageService.repairImage(inputPath, outputPath, {
      removeScratches,
      removeStains,
      enhanceContrast,
      sharpen
    });

    rubbing.processedImage = `/uploads/${outputFilename}`;
    await rubbing.save();

    res.json({
      message: '图像修复完成',
      repairedImage: rubbing.processedImage,
      result
    });
  } catch (error) {
    console.error('图像修复失败:', error);
    res.status(500).json({ message: '图像修复失败', error: error.message });
  }
};

exports.exportRubbing = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'txt', options = {} } = req.body;
    
    const rubbing = await Rubbing.findById(id).populate('uploadedBy', 'username');
    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    const timestamp = Date.now();
    const safeTitle = rubbing.title.replace(/[^\w\u4e00-\u9fa5]/g, '_');
    const filename = `${safeTitle}_${timestamp}`;
    let outputPath, contentType, downloadName;

    switch (format.toLowerCase()) {
      case 'txt':
        outputPath = path.join(UPLOADS_DIR, `${filename}.txt`);
        await exportService.exportAsText(rubbing, outputPath, options);
        contentType = 'text/plain; charset=utf-8';
        downloadName = `${rubbing.title}.txt`;
        break;
      case 'html':
        outputPath = path.join(UPLOADS_DIR, `${filename}.html`);
        await exportService.exportAsHTML(rubbing, outputPath, options);
        contentType = 'text/html; charset=utf-8';
        downloadName = `${rubbing.title}.html`;
        break;
      case 'csv':
        outputPath = path.join(UPLOADS_DIR, `${filename}.csv`);
        await exportService.exportAsCSV(rubbing, outputPath, options);
        contentType = 'text/csv; charset=utf-8';
        downloadName = `${rubbing.title}.csv`;
        break;
      case 'json':
        outputPath = path.join(UPLOADS_DIR, `${filename}.json`);
        await exportService.exportAsJSON(rubbing, outputPath, options);
        contentType = 'application/json; charset=utf-8';
        downloadName = `${rubbing.title}.json`;
        break;
      default:
        return res.status(400).json({ 
          message: '不支持的导出格式',
          supportedFormats: ['txt', 'html', 'csv', 'json']
        });
    }

    const fileUrl = `/uploads/${path.basename(outputPath)}`;
    const stats = await fs.promises.stat(outputPath);

    res.json({
      message: '导出成功',
      downloadUrl: fileUrl,
      format,
      size: stats.size,
      filename: downloadName
    });
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ message: '导出失败', error: error.message });
  }
};

exports.getExportFormats = async (req, res) => {
  try {
    res.json({
      formats: exportService.getExportFormats()
    });
  } catch (error) {
    res.status(500).json({ message: '获取导出格式失败', error: error.message });
  }
};

exports.lookupCharacter = async (req, res) => {
  try {
    const { char } = req.params;
    
    if (!char || char.length > 1) {
      return res.status(400).json({ message: '请提供单个字符' });
    }

    const result = imageService.lookUpCharacter(char);

    res.json(result);
  } catch (error) {
    console.error('字符查询失败:', error);
    res.status(500).json({ message: '字符查询失败', error: error.message });
  }
};

exports.searchDictionary = async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ message: '请提供搜索关键词' });
    }

    const result = imageService.searchCharacters(keyword);

    res.json(result);
  } catch (error) {
    console.error('字典搜索失败:', error);
    res.status(500).json({ message: '字典搜索失败', error: error.message });
  }
};

exports.getDictionaryStats = async (req, res) => {
  try {
    const stats = imageService.getDictionaryStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: '获取字典统计失败', error: error.message });
  }
};
