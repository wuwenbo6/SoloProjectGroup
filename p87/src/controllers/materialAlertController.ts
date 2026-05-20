import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import Material from '../models/trace/Material';
import Batch from '../models/process/Batch';

export const getExpiringMaterials = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      days: Joi.number().integer().min(1).max(365).default(30),
      materialType: Joi.string().optional(),
      status: Joi.string().valid('in_stock', 'used', 'expired').optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { days, materialType, status } = value;
    const today = new Date();
    const warningDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    const where: any = {
      expiryDate: {
        [Op.lte]: warningDate,
        [Op.gt]: today
      },
      status: status || 'in_stock'
    };

    if (materialType) {
      where.materialType = materialType;
    }

    const materials = await Material.findAll({
      where,
      order: [['expiryDate', 'ASC']]
    });

    const materialsWithWarning = materials.map(material => {
      const expiryDate = new Date(material.expiryDate!);
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      
      let warningLevel = 'normal';
      if (daysRemaining <= 7) {
        warningLevel = 'critical';
      } else if (daysRemaining <= 30) {
        warningLevel = 'warning';
      }

      return {
        ...material.toJSON(),
        daysRemaining,
        warningLevel
      };
    });

    const statistics = {
      total: materialsWithWarning.length,
      critical: materialsWithWarning.filter((m: any) => m.warningLevel === 'critical').length,
      warning: materialsWithWarning.filter((m: any) => m.warningLevel === 'warning').length,
      daysRange: days
    };

    res.json({
      success: true,
      message: '获取即将过期原料成功',
      data: {
        materials: materialsWithWarning,
        statistics
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取即将过期原料失败',
      error: (error as Error).message
    });
  }
};

export const getExpiredMaterials = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, materialType } = req.query;

    const where: any = {
      expiryDate: {
        [Op.lte]: new Date()
      }
    };

    if (materialType) {
      where.materialType = materialType;
    }

    const { count, rows } = await Material.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['expiryDate', 'DESC']]
    });

    res.json({
      success: true,
      message: '获取已过期原料成功',
      data: {
        materials: rows,
        total: count,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取已过期原料失败',
      error: (error as Error).message
    });
  }
};

export const getBatchMaterialExpiryWarning = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findOne({ where: { batchId } });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    const where: any = {
      status: 'in_stock'
    };

    const materials = await Material.findAll({ where });

    const today = new Date();
    const warningMaterials = materials.map(material => {
      if (!material.expiryDate) {
        return {
          ...material.toJSON(),
          daysRemaining: null,
          warningLevel: 'unknown'
        };
      }

      const expiryDate = new Date(material.expiryDate);
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      let warningLevel = 'normal';
      if (daysRemaining <= 0) {
        warningLevel = 'expired';
      } else if (daysRemaining <= 7) {
        warningLevel = 'critical';
      } else if (daysRemaining <= 30) {
        warningLevel = 'warning';
      }

      return {
        ...material.toJSON(),
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        warningLevel
      };
    });

    const hasExpired = warningMaterials.some((m: any) => m.warningLevel === 'expired');
    const hasCritical = warningMaterials.some((m: any) => m.warningLevel === 'critical');
    const hasWarning = warningMaterials.some((m: any) => m.warningLevel === 'warning');

    let batchStatus = 'normal';
    if (hasExpired) {
      batchStatus = 'dangerous';
    } else if (hasCritical) {
      batchStatus = 'critical';
    } else if (hasWarning) {
      batchStatus = 'warning';
    }

    res.json({
      success: true,
      message: '获取批次原料过期预警成功',
      data: {
        batch,
        batchStatus,
        materials: warningMaterials,
        summary: {
          total: warningMaterials.length,
          expired: warningMaterials.filter((m: any) => m.warningLevel === 'expired').length,
          critical: warningMaterials.filter((m: any) => m.warningLevel === 'critical').length,
          warning: warningMaterials.filter((m: any) => m.warningLevel === 'warning').length,
          normal: warningMaterials.filter((m: any) => m.warningLevel === 'normal').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取批次原料过期预警失败',
      error: (error as Error).message
    });
  }
};

export const getAlertStatistics = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const oneWeekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalInStock, expired, critical, warning] = await Promise.all([
      Material.count({ where: { status: 'in_stock' } }),
      Material.count({
        where: {
          expiryDate: { [Op.lte]: today },
          status: 'in_stock'
        }
      }),
      Material.count({
        where: {
          expiryDate: { [Op.between]: [today, oneWeekLater] },
          status: 'in_stock'
        }
      }),
      Material.count({
        where: {
          expiryDate: { [Op.between]: [oneWeekLater, oneMonthLater] },
          status: 'in_stock'
        }
      })
    ]);

    res.json({
      success: true,
      message: '获取预警统计成功',
      data: {
        totalInStock,
        expired,
        critical,
        warning,
        safe: totalInStock - expired - critical - warning,
        needAttention: expired + critical + warning
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取预警统计失败',
      error: (error as Error).message
    });
  }
};
