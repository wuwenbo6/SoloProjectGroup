const RestorationArchive = require('../models/restoration/RestorationArchive');
const RestorationProgress = require('../models/restoration/RestorationProgress');
const RestorationTechnique = require('../models/technique/RestorationTechnique');
const ThirdPartyDetection = require('../models/technique/ThirdPartyDetection');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

exports.createArchive = async (req, res) => {
  try {
    const { bookId, bookCode, title, archiveType, description } = req.body;
    
    const archiveNumber = `ARC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const traceId = TraceUtil.generateTraceId();
    
    const archive = await RestorationArchive.create({
      ...req.body,
      archiveNumber,
      traceId,
      status: 'draft'
    });

    TraceUtil.logOperation(traceId, 'create_archive', { bookId, archiveId: archive.id }, req.user?.id);

    res.status(201).json({
      message: '档案创建成功',
      data: archive
    });
  } catch (error) {
    logger.error('创建档案失败:', error);
    res.status(500).json({ error: '创建档案失败', message: error.message });
  }
};

exports.generateArchive = async (req, res) => {
  try {
    const { bookId, bookCode } = req.body;
    
    const progressList = await RestorationProgress.findAll({ where: { bookId } });
    const techniques = await RestorationTechnique.findAll({ where: { bookId } });
    const detections = await ThirdPartyDetection.findAll({ where: { bookId } });
    
    const archiveNumber = `ARC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const traceId = TraceUtil.generateTraceId();
    
    const chiefRestorer = progressList.length > 0 ? progressList[0].restorerName : '';
    const restorerList = [...new Set(progressList.map(p => p.restorerName).filter(Boolean))];
    const techniqueNames = [...new Set(techniques.map(t => t.techniqueName).filter(Boolean))];
    
    const totalDuration = progressList.reduce((sum, p) => {
      if (p.startedAt && p.completedAt) {
        return sum + (new Date(p.completedAt) - new Date(p.startedAt)) / 3600000;
      }
      return sum;
    }, 0);
    
    const archive = await RestorationArchive.create({
      bookId,
      bookCode,
      archiveNumber,
      title: `${bookCode} 修复档案`,
      archiveType: 'full_archive',
      description: '系统自动生成的完整修复档案',
      chiefRestorer,
      restorerList,
      totalDuration: Math.round(totalDuration),
      techniquesApplied: techniqueNames,
      files: detections.map(d => d.reportFile).filter(Boolean),
      traceId,
      status: 'submitted'
    });

    TraceUtil.logOperation(traceId, 'generate_archive', { bookId, archiveId: archive.id }, req.user?.id);

    res.status(201).json({
      message: '档案生成成功',
      data: archive
    });
  } catch (error) {
    logger.error('生成档案失败:', error);
    res.status(500).json({ error: '生成档案失败', message: error.message });
  }
};

exports.getArchiveById = async (req, res) => {
  try {
    const { id } = req.params;
    const archive = await RestorationArchive.findByPk(id);
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    res.json({ data: archive });
  } catch (error) {
    logger.error('获取档案失败:', error);
    res.status(500).json({ error: '获取档案失败', message: error.message });
  }
};

exports.getArchiveByArchiveNumber = async (req, res) => {
  try {
    const { archiveNumber } = req.params;
    const archive = await RestorationArchive.findOne({ where: { archiveNumber } });
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    res.json({ data: archive });
  } catch (error) {
    logger.error('获取档案失败:', error);
    res.status(500).json({ error: '获取档案失败', message: error.message });
  }
};

exports.getArchivesByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const archives = await RestorationArchive.findAll({
      where: { bookId },
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: archives });
  } catch (error) {
    logger.error('获取档案列表失败:', error);
    res.status(500).json({ error: '获取档案列表失败', message: error.message });
  }
};

exports.getAllArchives = async (req, res) => {
  try {
    const { page = 1, limit = 20, archiveType, status, accessLevel, keyword } = req.query;
    
    const where = {};
    if (archiveType) where.archiveType = archiveType;
    if (status) where.status = status;
    if (accessLevel) where.accessLevel = accessLevel;
    if (keyword) {
      where[Op.or] = [
        { archiveNumber: { [Op.like]: `%${keyword}%` } },
        { bookCode: { [Op.like]: `%${keyword}%` } },
        { title: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await RestorationArchive.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('获取档案列表失败:', error);
    res.status(500).json({ error: '获取档案列表失败', message: error.message });
  }
};

exports.updateArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const archive = await RestorationArchive.findByPk(id);
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    await archive.update(req.body);

    TraceUtil.logOperation(archive.traceId, 'update_archive', { archiveId: id }, req.user?.id);

    res.json({
      message: '档案更新成功',
      data: archive
    });
  } catch (error) {
    logger.error('更新档案失败:', error);
    res.status(500).json({ error: '更新档案失败', message: error.message });
  }
};

exports.submitArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const archive = await RestorationArchive.findByPk(id);
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    if (archive.status !== 'draft') {
      return res.status(400).json({ error: '只有草稿状态可提交' });
    }

    await archive.update({ status: 'submitted' });

    TraceUtil.logOperation(archive.traceId, 'submit_archive', { archiveId: id }, req.user?.id);

    res.json({
      message: '档案提交成功',
      data: { id: archive.id, status: archive.status }
    });
  } catch (error) {
    logger.error('提交档案失败:', error);
    res.status(500).json({ error: '提交档案失败', message: error.message });
  }
};

exports.reviewArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;
    
    const archive = await RestorationArchive.findByPk(id);
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    if (archive.status !== 'submitted') {
      return res.status(400).json({ error: '只有已提交状态可审核' });
    }

    await archive.update({
      status,
      reviewedBy: req.user?.id,
      reviewedAt: new Date(),
      reviewNotes
    });

    TraceUtil.logOperation(archive.traceId, 'review_archive', { archiveId: id, status }, req.user?.id);

    res.json({
      message: '审核完成',
      data: archive
    });
  } catch (error) {
    logger.error('审核档案失败:', error);
    res.status(500).json({ error: '审核档案失败', message: error.message });
  }
};

exports.archiveFinal = async (req, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    
    const archive = await RestorationArchive.findByPk(id);
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    if (archive.status !== 'reviewed') {
      return res.status(400).json({ error: '只有已审核状态可归档' });
    }

    await archive.update({
      status: 'archived',
      archivedBy: req.user?.id,
      archivedAt: new Date(),
      location
    });

    TraceUtil.logOperation(archive.traceId, 'archive_final', { archiveId: id }, req.user?.id);

    res.json({
      message: '归档完成',
      data: archive
    });
  } catch (error) {
    logger.error('归档失败:', error);
    res.status(500).json({ error: '归档失败', message: error.message });
  }
};

exports.deleteArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const archive = await RestorationArchive.findByPk(id);
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    await archive.destroy();

    res.json({ message: '档案删除成功' });
  } catch (error) {
    logger.error('删除档案失败:', error);
    res.status(500).json({ error: '删除档案失败', message: error.message });
  }
};

exports.getArchiveTypes = async (req, res) => {
  try {
    const types = [
      { code: 'restoration_report', name: '修复报告', description: '修复过程和结果的正式报告' },
      { code: 'photo_record', name: '影像记录', description: '修复前后及过程的影像资料' },
      { code: 'technique_record', name: '工艺记录', description: '使用的修复工艺详细记录' },
      { code: 'inspection_report', name: '检测报告', description: '第三方检测机构的报告' },
      { code: 'full_archive', name: '完整档案', description: '包含所有内容的完整档案' }
    ];

    res.json({ data: types });
  } catch (error) {
    logger.error('获取档案类型失败:', error);
    res.status(500).json({ error: '获取档案类型失败', message: error.message });
  }
};

exports.downloadArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const archive = await RestorationArchive.findByPk(id);
    
    if (!archive) {
      return res.status(404).json({ error: '档案不存在' });
    }

    const progressList = await RestorationProgress.findAll({ where: { bookId: archive.bookId } });
    const techniques = await RestorationTechnique.findAll({ where: { bookId: archive.bookId } });
    const detections = await ThirdPartyDetection.findAll({ where: { bookId: archive.bookId } });

    const downloadData = {
      archive: archive.toJSON(),
      restorationProgress: progressList.map(p => p.toJSON()),
      techniques: techniques.map(t => t.toJSON()),
      detections: detections.map(d => d.toJSON()),
      generatedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.archiveNumber}.json"`);
    res.json(downloadData);
  } catch (error) {
    logger.error('下载档案失败:', error);
    res.status(500).json({ error: '下载档案失败', message: error.message });
  }
};
