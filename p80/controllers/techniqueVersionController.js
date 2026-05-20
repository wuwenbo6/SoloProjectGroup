const TechniqueVersion = require('../models/technique/TechniqueVersion');
const RestorationTechnique = require('../models/technique/RestorationTechnique');
const logger = require('../utils/logger');
const { Op, Transaction } = require('sequelize');
const { techniqueDB } = require('../config/databases');

exports.createVersion = async (req, res) => {
  const transaction = await techniqueDB.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
  });

  try {
    const { techniqueId, versionType = 'minor', changeReason, changeLog } = req.body;
    
    const technique = await RestorationTechnique.findByPk(techniqueId);
    if (!technique) {
      await transaction.rollback();
      return res.status(404).json({ error: '工艺不存在' });
    }

    const lastVersion = await TechniqueVersion.findOne({
      where: { techniqueId },
      order: [['createdAt', 'DESC']],
      transaction
    });

    const newVersionNumber = generateNextVersion(lastVersion?.versionNumber, versionType);

    await TechniqueVersion.update(
      { isCurrentVersion: false },
      { where: { techniqueId }, transaction }
    );

    const version = await TechniqueVersion.create({
      techniqueId,
      bookId: technique.bookId,
      bookCode: technique.bookCode,
      versionNumber: newVersionNumber,
      versionType,
      techniqueName: technique.techniqueName,
      techniqueType: technique.techniqueType,
      description: technique.description,
      materials: technique.materials,
      tools: technique.tools,
      steps: technique.steps,
      environment: technique.environment,
      operatorId: technique.operatorId,
      operatorName: technique.operatorName,
      operatedAt: technique.operatedAt,
      duration: technique.duration,
      changeReason,
      changeLog,
      createdBy: req.user?.id,
      isCurrentVersion: true,
      parentVersionId: lastVersion?.id
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      message: '版本创建成功',
      data: version
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('创建版本失败:', error);
    res.status(500).json({ error: '创建版本失败', message: error.message });
  }
};

function generateNextVersion(lastVersion, versionType) {
  if (!lastVersion) return '1.0.0';

  const parts = lastVersion.split('.').map(p => parseInt(p) || 0);
  while (parts.length < 3) parts.push(0);

  switch (versionType) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
    case 'revision':
      parts[2]++;
      break;
    default:
      parts[2]++;
  }

  return parts.join('.');
}

exports.getVersionsByTechniqueId = async (req, res) => {
  try {
    const { techniqueId } = req.params;
    const { includeObsolete = 'false', page = 1, limit = 20 } = req.query;
    
    const where = { techniqueId };
    if (includeObsolete !== 'true') {
      where.verificationStatus = { [Op.ne]: 'obsolete' };
    }

    const { count, rows } = await TechniqueVersion.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['versionNumber', 'DESC']]
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
    logger.error('获取版本列表失败:', error);
    res.status(500).json({ error: '获取版本列表失败', message: error.message });
  }
};

exports.getVersionsByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { techniqueType, currentOnly } = req.query;
    
    const where = { bookId };
    if (techniqueType) where.techniqueType = techniqueType;
    if (currentOnly === 'true') where.isCurrentVersion = true;

    const versions = await TechniqueVersion.findAll({
      where,
      order: [['techniqueId', 'ASC'], ['versionNumber', 'DESC']]
    });

    res.json({ data: versions });
  } catch (error) {
    logger.error('获取善本版本列表失败:', error);
    res.status(500).json({ error: '获取善本版本列表失败', message: error.message });
  }
};

exports.getVersionById = async (req, res) => {
  try {
    const { id } = req.params;
    const version = await TechniqueVersion.findByPk(id);
    
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    res.json({ data: version });
  } catch (error) {
    logger.error('获取版本详情失败:', error);
    res.status(500).json({ error: '获取版本详情失败', message: error.message });
  }
};

exports.getCurrentVersion = async (req, res) => {
  try {
    const { techniqueId } = req.params;
    const version = await TechniqueVersion.findOne({
      where: { techniqueId, isCurrentVersion: true }
    });
    
    if (!version) {
      return res.status(404).json({ error: '未找到当前版本' });
    }

    res.json({ data: version });
  } catch (error) {
    logger.error('获取当前版本失败:', error);
    res.status(500).json({ error: '获取当前版本失败', message: error.message });
  }
};

exports.setCurrentVersion = async (req, res) => {
  const transaction = await techniqueDB.transaction();

  try {
    const { id } = req.params;
    const version = await TechniqueVersion.findByPk(id, { transaction });
    
    if (!version) {
      await transaction.rollback();
      return res.status(404).json({ error: '版本不存在' });
    }

    await TechniqueVersion.update(
      { isCurrentVersion: false },
      { where: { techniqueId: version.techniqueId }, transaction }
    );

    await version.update({ isCurrentVersion: true }, { transaction });
    await transaction.commit();

    res.json({
      message: '设置当前版本成功',
      data: version
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('设置当前版本失败:', error);
    res.status(500).json({ error: '设置当前版本失败', message: error.message });
  }
};

exports.verifyVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;
    
    const version = await TechniqueVersion.findByPk(id);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    await version.update({
      verificationStatus,
      verifiedBy: req.user?.id,
      verifiedAt: new Date(),
      verificationNotes
    });

    res.json({
      message: '版本验证完成',
      data: version
    });
  } catch (error) {
    logger.error('验证版本失败:', error);
    res.status(500).json({ error: '验证版本失败', message: error.message });
  }
};

exports.setBaselineVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBaseline } = req.body;
    
    const version = await TechniqueVersion.findByPk(id);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    await version.update({ isBaseline });

    res.json({
      message: isBaseline ? '已设置为基线版本' : '已取消基线版本',
      data: version
    });
  } catch (error) {
    logger.error('设置基线版本失败:', error);
    res.status(500).json({ error: '设置基线版本失败', message: error.message });
  }
};

exports.getBaselineVersions = async (req, res) => {
  try {
    const { bookId, techniqueType } = req.query;
    
    const where = { isBaseline: true };
    if (bookId) where.bookId = bookId;
    if (techniqueType) where.techniqueType = techniqueType;

    const versions = await TechniqueVersion.findAll({
      where,
      order: [['bookId', 'ASC'], ['techniqueType', 'ASC'], ['versionNumber', 'DESC']]
    });

    res.json({ data: versions });
  } catch (error) {
    logger.error('获取基线版本列表失败:', error);
    res.status(500).json({ error: '获取基线版本列表失败', message: error.message });
  }
};

exports.compareVersions = async (req, res) => {
  try {
    const { versionId1, versionId2 } = req.query;
    
    const version1 = await TechniqueVersion.findByPk(versionId1);
    const version2 = await TechniqueVersion.findByPk(versionId2);
    
    if (!version1 || !version2) {
      return res.status(404).json({ error: '版本不存在' });
    }

    if (version1.techniqueId !== version2.techniqueId) {
      return res.status(400).json({ error: '只能比较同一工艺的不同版本' });
    }

    const comparison = {
      version1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        versionType: version1.versionType,
        createdAt: version1.createdAt
      },
      version2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        versionType: version2.versionType,
        createdAt: version2.createdAt
      },
      differences: {}
    };

    const fieldsToCompare = ['techniqueName', 'techniqueType', 'description', 'duration', 'operatorName'];
    fieldsToCompare.forEach(field => {
      if (version1[field] !== version2[field]) {
        comparison.differences[field] = {
          version1: version1[field],
          version2: version2[field]
        };
      }
    });

    const jsonFields = ['materials', 'tools', 'environment'];
    jsonFields.forEach(field => {
      const v1 = JSON.stringify(version1[field]);
      const v2 = JSON.stringify(version2[field]);
      if (v1 !== v2) {
        comparison.differences[field] = {
          changed: true,
          note: `${field} 配置有差异`
        };
      }
    });

    const changeCount = Object.keys(comparison.differences).length;
    comparison.hasChanges = changeCount > 0;
    comparison.changeCount = changeCount;

    res.json({
      message: '版本比较完成',
      data: comparison
    });
  } catch (error) {
    logger.error('版本比较失败:', error);
    res.status(500).json({ error: '版本比较失败', message: error.message });
  }
};

exports.restoreVersion = async (req, res) => {
  const transaction = await techniqueDB.transaction();

  try {
    const { id } = req.params;
    const { createNewVersion = true } = req.body;
    
    const version = await TechniqueVersion.findByPk(id, { transaction });
    if (!version) {
      await transaction.rollback();
      return res.status(404).json({ error: '版本不存在' });
    }

    const technique = await RestorationTechnique.findByPk(version.techniqueId, { transaction });
    if (!technique) {
      await transaction.rollback();
      return res.status(404).json({ error: '工艺不存在' });
    }

    await technique.update({
      techniqueName: version.techniqueName,
      techniqueType: version.techniqueType,
      description: version.description,
      materials: version.materials,
      tools: version.tools,
      steps: version.steps,
      environment: version.environment,
      duration: version.duration
    }, { transaction });

    if (createNewVersion) {
      const lastVersion = await TechniqueVersion.findOne({
        where: { techniqueId: version.techniqueId },
        order: [['createdAt', 'DESC']],
        transaction
      });

      const newVersionNumber = generateNextVersion(lastVersion?.versionNumber, 'patch');

      await TechniqueVersion.update(
        { isCurrentVersion: false },
        { where: { techniqueId: version.techniqueId }, transaction }
      );

      await TechniqueVersion.create({
        techniqueId: version.techniqueId,
        bookId: version.bookId,
        bookCode: version.bookCode,
        versionNumber: newVersionNumber,
        versionType: 'patch',
        techniqueName: version.techniqueName,
        techniqueType: version.techniqueType,
        description: version.description,
        materials: version.materials,
        tools: version.tools,
        steps: version.steps,
        environment: version.environment,
        operatorId: version.operatorId,
        operatorName: version.operatorName,
        operatedAt: version.operatedAt,
        duration: version.duration,
        changeReason: `恢复到版本 ${version.versionNumber}`,
        changeLog: `从版本 ${version.versionNumber} 恢复`,
        createdBy: req.user?.id,
        isCurrentVersion: true,
        parentVersionId: version.id
      }, { transaction });
    }

    await transaction.commit();

    res.json({
      message: '版本恢复成功',
      data: { technique, restoredFrom: version.versionNumber }
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('恢复版本失败:', error);
    res.status(500).json({ error: '恢复版本失败', message: error.message });
  }
};

exports.deleteVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const version = await TechniqueVersion.findByPk(id);
    
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    if (version.isCurrentVersion) {
      return res.status(400).json({ error: '不能删除当前版本，请先设置其他版本为当前版本' });
    }

    if (version.isBaseline) {
      return res.status(400).json({ error: '不能删除基线版本，请先取消基线标记' });
    }

    await version.destroy();

    res.json({ message: '版本删除成功' });
  } catch (error) {
    logger.error('删除版本失败:', error);
    res.status(500).json({ error: '删除版本失败', message: error.message });
  }
};

exports.getVersionStatistics = async (req, res) => {
  try {
    const { bookId } = req.query;
    
    const where = {};
    if (bookId) where.bookId = bookId;

    const totalVersions = await TechniqueVersion.count({ where });
    const currentVersions = await TechniqueVersion.count({ where: { ...where, isCurrentVersion: true } });
    const baselineVersions = await TechniqueVersion.count({ where: { ...where, isBaseline: true } });
    const verifiedVersions = await TechniqueVersion.count({ where: { ...where, verificationStatus: 'verified' } });

    const byType = await TechniqueVersion.findAll({
      attributes: ['techniqueType', [TechniqueVersion.sequelize.fn('COUNT', '*'), 'count']],
      where,
      group: ['techniqueType']
    });

    const byStatus = await TechniqueVersion.findAll({
      attributes: ['verificationStatus', [TechniqueVersion.sequelize.fn('COUNT', '*'), 'count']],
      where,
      group: ['verificationStatus']
    });

    res.json({
      data: {
        counts: {
          total: totalVersions,
          current: currentVersions,
          baseline: baselineVersions,
          verified: verifiedVersions
        },
        byType,
        byStatus
      }
    });
  } catch (error) {
    logger.error('获取版本统计失败:', error);
    res.status(500).json({ error: '获取版本统计失败', message: error.message });
  }
};

exports.exportVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const version = await TechniqueVersion.findByPk(id);
    
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    const exportData = {
      versionInfo: {
        versionNumber: version.versionNumber,
        versionType: version.versionType,
        techniqueName: version.techniqueName,
        techniqueType: version.techniqueType,
        created: version.createdAt,
        exportedAt: new Date().toISOString()
      },
      techniqueSpecs: {
        description: version.description,
        materials: version.materials,
        tools: version.tools,
        steps: version.steps,
        environment: version.environment,
        duration: version.duration
      },
      operator: {
        operatorId: version.operatorId,
        operatorName: version.operatorName,
        operatedAt: version.operatedAt
      },
      verification: {
        status: version.verificationStatus,
        verifiedBy: version.verifiedBy,
        verifiedAt: version.verifiedAt,
        notes: version.verificationNotes
      },
      changeInfo: {
        changeReason: version.changeReason,
        changeLog: version.changeLog,
        isBaseline: version.isBaseline,
        isCurrentVersion: version.isCurrentVersion
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="technique-version-${version.versionNumber}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('导出版本失败:', error);
    res.status(500).json({ error: '导出版本失败', message: error.message });
  }
};

exports.updateVersionTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    const version = await TechniqueVersion.findByPk(id);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    await version.update({ tags });

    res.json({
      message: '标签更新成功',
      data: { id: version.id, tags: version.tags }
    });
  } catch (error) {
    logger.error('更新标签失败:', error);
    res.status(500).json({ error: '更新标签失败', message: error.message });
  }
};
