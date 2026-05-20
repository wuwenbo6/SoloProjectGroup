const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const RestorationArchive = require('../models/restoration/RestorationArchive');
const RestorationProgress = require('../models/restoration/RestorationProgress');
const RestorationTechnique = require('../models/technique/RestorationTechnique');
const ThirdPartyDetection = require('../models/technique/ThirdPartyDetection');
const RareBook = require('../models/rareBook/RareBook');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const exportDir = 'exports';
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const generateArchivePDF = async (archive, includeDetails = true) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `修复档案 - ${archive.archiveNumber}`,
        Author: '古籍修复管理系统',
        Subject: archive.title
      }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(24).font('Helvetica-Bold').text('古籍修复档案', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#666666').text(`档案编号: ${archive.archiveNumber}`, { align: 'center' });
    doc.moveDown(1);

    doc.strokeColor('#336699').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333').text('基本信息');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    
    const basicInfo = [
      ['善本编号', archive.bookCode],
      ['档案标题', archive.title],
      ['档案类型', getArchiveTypeName(archive.archiveType)],
      ['首席修复师', archive.chiefRestorer || '-'],
      ['创建日期', archive.createdAt ? new Date(archive.createdAt).toLocaleDateString('zh-CN') : '-'],
      ['归档日期', archive.archivedAt ? new Date(archive.archivedAt).toLocaleDateString('zh-CN') : '-'],
      ['总工时', archive.totalDuration ? `${archive.totalDuration} 小时` : '-'],
      ['状态', getArchiveStatusName(archive.status)],
      ['访问级别', getAccessLevelName(archive.accessLevel)]
    ];

    basicInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').fillColor('#555555').text(value);
      doc.fillColor('#333333');
    });

    if (archive.description) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('档案描述:');
      doc.font('Helvetica').fillColor('#555555').text(archive.description);
      doc.fillColor('#333333');
    }

    if (includeDetails) {
      const progressList = await RestorationProgress.findAll({ where: { bookId: archive.bookId } });
      const techniques = await RestorationTechnique.findAll({ where: { bookId: archive.bookId } });
      const detections = await ThirdPartyDetection.findAll({ where: { bookId: archive.bookId } });

      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('修复进度记录');
      doc.moveDown(0.5);

      if (progressList.length > 0) {
        progressList.forEach((progress, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${progress.stepName}`);
          doc.fontSize(10).font('Helvetica').fillColor('#666666');
          doc.text(`   状态: ${getProgressStatusName(progress.status)}  |  进度: ${progress.progressPercent}%  |  修复师: ${progress.restorerName || '-'}`);
          if (progress.qualityCheck !== 'pending') {
            doc.text(`   质检结果: ${getQualityCheckName(progress.qualityCheck)}`);
          }
          doc.fillColor('#333333');
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(12).font('Helvetica').fillColor('#999999').text('暂无进度记录');
        doc.fillColor('#333333');
      }

      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('修复工艺记录');
      doc.moveDown(0.5);

      if (techniques.length > 0) {
        techniques.forEach((tech, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${tech.techniqueName}`);
          doc.fontSize(10).font('Helvetica').fillColor('#666666');
          doc.text(`   类型: ${getTechniqueTypeName(tech.techniqueType)}  |  操作人员: ${tech.operatorName || '-'}`);
          if (tech.duration) {
            doc.text(`   耗时: ${tech.duration} 分钟`);
          }
          if (tech.description) {
            doc.text(`   描述: ${tech.description.substring(0, 100)}${tech.description.length > 100 ? '...' : ''}`);
          }
          doc.fillColor('#333333');
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(12).font('Helvetica').fillColor('#999999').text('暂无工艺记录');
        doc.fillColor('#333333');
      }

      if (detections.length > 0) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('第三方检测记录');
        doc.moveDown(0.5);

        detections.forEach((det, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${det.organization || '未知机构'}`);
          doc.fontSize(10).font('Helvetica').fillColor('#666666');
          doc.text(`   检测类型: ${getDetectionTypeName(det.detectionType)}  |  同步状态: ${getSyncStatusName(det.syncStatus)}`);
          if (det.conclusion) {
            doc.text(`   结论: ${det.conclusion.substring(0, 150)}${det.conclusion.length > 150 ? '...' : ''}`);
          }
          doc.fillColor('#333333');
          doc.moveDown(0.3);
        });
      }
    }

    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('档案审核记录');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    
    const auditInfo = [
      ['审核人', archive.reviewedBy ? '已审核' : '待审核'],
      ['审核时间', archive.reviewedAt ? new Date(archive.reviewedAt).toLocaleDateString('zh-CN') : '-'],
      ['审核意见', archive.reviewNotes || '-'],
      ['归档人', archive.archivedBy ? '已归档' : '待归档'],
      ['存放位置', archive.location || '-']
    ];

    auditInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').fillColor('#555555').text(value);
      doc.fillColor('#333333');
    });

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#999999').text('本PDF由古籍修复管理系统自动生成', { align: 'center' });
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });

    doc.end();
  });
};

function getArchiveTypeName(type) {
  const names = {
    restoration_report: '修复报告',
    photo_record: '影像记录',
    technique_record: '工艺记录',
    inspection_report: '检测报告',
    full_archive: '完整档案'
  };
  return names[type] || type;
}

function getArchiveStatusName(status) {
  const names = {
    draft: '草稿',
    submitted: '已提交',
    reviewed: '已审核',
    archived: '已归档',
    rejected: '已驳回'
  };
  return names[status] || status;
}

function getAccessLevelName(level) {
  const names = {
    public: '公开',
    internal: '内部',
    confidential: '机密'
  };
  return names[level] || level;
}

function getProgressStatusName(status) {
  const names = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    paused: '已暂停',
    cancelled: '已取消'
  };
  return names[status] || status;
}

function getQualityCheckName(status) {
  const names = {
    pending: '待质检',
    passed: '通过',
    failed: '未通过',
    rework: '需返工'
  };
  return names[status] || status;
}

function getTechniqueTypeName(type) {
  const names = {
    cleaning: '清洁',
    repair: '修复',
    reinforcement: '加固',
    mounting: '装裱',
    sealing: '封护',
    other: '其他'
  };
  return names[type] || type;
}

function getDetectionTypeName(type) {
  const names = {
    material_analysis: '材质分析',
    age_dating: '年代测定',
    damage_assessment: '破损评估',
    microscopic_examination: '显微检测',
    full_analysis: '全面分析'
  };
  return names[type] || type;
}

function getSyncStatusName(status) {
  const names = {
    pending: '待同步',
    synced: '已同步',
    failed: '同步失败',
    partial: '部分同步'
  };
  return names[status] || status;
}

exports.exportSinglePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeDetails = 'true' } = req.query;
    
    const archive = await RestorationArchive.findByPk(id);
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    const pdfBuffer = await generateArchivePDF(archive, includeDetails === 'true');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.archiveNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('导出单PDF失败:', error);
    res.status(500).json({ error: '导出PDF失败', message: error.message });
  }
};

exports.exportBatchPDF = async (req, res) => {
  try {
    const { archiveIds, bookId, archiveType, includeDetails = true } = req.body;
    
    let where = {};
    if (archiveIds && archiveIds.length > 0) {
      where.id = { [Op.in]: archiveIds };
    }
    if (bookId) where.bookId = bookId;
    if (archiveType) where.archiveType = archiveType;

    const archives = await RestorationArchive.findAll({ where });
    if (archives.length === 0) {
      return res.status(404).json({ error: '未找到符合条件的档案' });
    }

    const zipFileName = `修复档案批量导出_${Date.now()}.zip`;
    const zipFilePath = path.join(exportDir, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const arc of archives) {
      const pdfBuffer = await generateArchivePDF(arc, includeDetails);
      archive.append(pdfBuffer, { name: `${arc.archiveNumber}_${arc.bookCode}.pdf` });
    }

    const manifestContent = generateManifest(archives);
    archive.append(manifestContent, { name: '导出清单.txt' });

    await archive.finalize();

    output.on('close', () => {
      res.download(zipFilePath, zipFileName, (err) => {
        if (err) logger.error('下载ZIP失败:', err);
        fs.unlinkSync(zipFilePath);
      });
    });
  } catch (error) {
    logger.error('批量导出PDF失败:', error);
    res.status(500).json({ error: '批量导出PDF失败', message: error.message });
  }
};

function generateManifest(archives) {
  let content = '古籍修复档案导出清单\n';
  content += '='.repeat(50) + '\n\n';
  content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
  content += `导出数量: ${archives.length} 份\n\n`;
  content += '-'.repeat(50) + '\n\n';

  archives.forEach((arc, index) => {
    content += `${index + 1}. 档案编号: ${arc.archiveNumber}\n`;
    content += `   善本编号: ${arc.bookCode}\n`;
    content += `   标题: ${arc.title}\n`;
    content += `   类型: ${getArchiveTypeName(arc.archiveType)}\n`;
    content += `   状态: ${getArchiveStatusName(arc.status)}\n`;
    content += `   创建时间: ${arc.createdAt ? new Date(arc.createdAt).toLocaleDateString('zh-CN') : '-'}\n\n`;
  });

  content += '='.repeat(50) + '\n';
  content += '本清单由古籍修复管理系统自动生成\n';
  return content;
}

exports.exportBookFullReport = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const book = await RareBook.findByPk(bookId);
    if (!book) {
      return res.status(404).json({ error: '善本不存在' });
    }

    const progressList = await RestorationProgress.findAll({ where: { bookId } });
    const techniques = await RestorationTechnique.findAll({ where: { bookId } });
    const detections = await ThirdPartyDetection.findAll({ where: { bookId } });
    const archives = await RestorationArchive.findAll({ where: { bookId } });

    const pdfBuffer = await generateFullReportPDF(book, progressList, techniques, detections, archives);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="完整修复报告_${book.bookCode}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('导出完整报告失败:', error);
    res.status(500).json({ error: '导出完整报告失败', message: error.message });
  }
};

const generateFullReportPDF = async (book, progressList, techniques, detections, archives) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `完整修复报告 - ${book.bookCode}`,
        Author: '古籍修复管理系统',
        Subject: book.title
      }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(26).font('Helvetica-Bold').text('古籍修复完整报告', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#666666').text(`${book.bookCode} - ${book.title}`, { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#336699').lineWidth(3).moveTo(100, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(1.5);

    doc.fontSize(16).font('Helvetica-Bold').text('一、善本基本信息');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    
    const bookInfo = [
      ['善本编号', book.bookCode],
      ['书名', book.title],
      ['作者', book.author || '-'],
      ['朝代', book.dynasty || '-'],
      ['版本', book.edition || '-'],
      ['材质', book.material || '-'],
      ['尺寸', book.dimensions || '-'],
      ['保存状况', getConditionName(book.condition)],
      ['收藏位置', book.location || '-'],
      ['当前状态', getBookStatusName(book.status)]
    ];

    bookInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').fillColor('#555555').text(value);
      doc.fillColor('#333333');
    });

    if (book.description) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('详细描述:');
      doc.font('Helvetica').fillColor('#555555').text(book.description);
      doc.fillColor('#333333');
    }

    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('二、修复进度概览');
    doc.moveDown(0.5);

    const completedSteps = progressList.filter(p => p.status === 'completed').length;
    const totalSteps = progressList.length;
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    doc.fontSize(12).font('Helvetica');
    doc.text(`总步骤数: ${totalSteps}  |  已完成: ${completedSteps}  |  总体进度: ${overallProgress}%`);
    doc.moveDown(0.5);

    progressList.forEach((progress, index) => {
      const isCompleted = progress.status === 'completed';
      doc.fontSize(12).font('Helvetica-Bold').fillColor(isCompleted ? '#2E7D32' : '#333333');
      doc.text(`${index + 1}. ${progress.stepName} - ${getProgressStatusName(progress.status)}`);
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`   进度: ${progress.progressPercent}%  |  修复师: ${progress.restorerName || '-'}  |  质检: ${getQualityCheckName(progress.qualityCheck)}`);
      doc.fillColor('#333333');
      doc.moveDown(0.3);
    });

    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('三、修复工艺明细');
    doc.moveDown(0.5);

    techniques.forEach((tech, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${tech.techniqueName}`);
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`   类型: ${getTechniqueTypeName(tech.techniqueType)}  |  操作人员: ${tech.operatorName || '-'}`);
      if (tech.duration) doc.text(`   耗时: ${tech.duration} 分钟`);
      if (tech.description) doc.text(`   描述: ${tech.description}`);
      doc.fillColor('#333333');
      doc.moveDown(0.3);
    });

    if (detections.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('四、第三方检测报告');
      doc.moveDown(0.5);

      detections.forEach((det, index) => {
        doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${det.organization || '未知机构'}`);
        doc.fontSize(10).font('Helvetica').fillColor('#666666');
        doc.text(`   检测类型: ${getDetectionTypeName(det.detectionType)}`);
        if (det.conclusion) doc.text(`   结论: ${det.conclusion}`);
        if (det.recommendations) doc.text(`   建议: ${det.recommendations}`);
        doc.fillColor('#333333');
        doc.moveDown(0.3);
      });
    }

    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('五、档案归档情况');
    doc.moveDown(0.5);

    archives.forEach((arc, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${arc.archiveNumber}`);
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`   标题: ${arc.title}  |  类型: ${getArchiveTypeName(arc.archiveType)}  |  状态: ${getArchiveStatusName(arc.status)}`);
      doc.fillColor('#333333');
      doc.moveDown(0.3);
    });

    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('六、修复总结');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');

    const totalDuration = techniques.reduce((sum, t) => sum + (t.duration || 0), 0);
    const verifiedTechniques = techniques.filter(t => t.verificationStatus === 'verified').length;

    doc.text(`修复总耗时: ${totalDuration} 分钟 (约 ${Math.round(totalDuration / 60)} 小时)`);
    doc.text(`使用工艺数: ${techniques.length} 项`);
    doc.text(`已验证工艺: ${verifiedTechniques} 项`);
    doc.text(`检测报告数: ${detections.length} 份`);
    doc.text(`已归档档案: ${archives.filter(a => a.status === 'archived').length} 份`);

    doc.moveDown(3);
    doc.fontSize(10).fillColor('#999999').text('本报告由古籍修复管理系统自动生成', { align: 'center' });
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });

    doc.end();
  });
};

function getConditionName(condition) {
  const names = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',
    damaged: '严重破损'
  };
  return names[condition] || condition;
}

function getBookStatusName(status) {
  const names = {
    available: '待修复',
    in_restoration: '修复中',
    archived: '已归档',
    on_display: '展览中'
  };
  return names[status] || status;
}

exports.getExportHistory = async (req, res) => {
  try {
    res.json({
      message: '导出记录获取成功',
      data: {
        note: '导出功能已就绪，支持单份导出、批量导出和完整报告导出',
        supportedFormats: ['PDF'],
        supportedModes: ['single', 'batch', 'full-report']
      }
    });
  } catch (error) {
    logger.error('获取导出历史失败:', error);
    res.status(500).json({ error: '获取导出历史失败', message: error.message });
  }
};
