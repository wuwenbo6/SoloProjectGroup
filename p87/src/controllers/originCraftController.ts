import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import Material from '../models/trace/Material';
import CraftProcess from '../models/process/CraftProcess';
import Batch from '../models/process/Batch';
import ProductionRecord from '../models/trace/ProductionRecord';
import { traceDB, processDB } from '../config/databases';

export const getOriginStatistics = async (req: Request, res: Response) => {
  try {
    const materials = await Material.findAll({
      attributes: ['origin', 'materialType', 'materialId']
    });

    const originStats: Record<string, any> = {};

    materials.forEach(material => {
      const origin = material.origin || '未知';
      if (!originStats[origin]) {
        originStats[origin] = {
          origin,
          totalMaterials: 0,
          materialTypes: new Set(),
          usedInBatches: 0
        };
      }
      originStats[origin].totalMaterials++;
      if (material.materialType) {
        originStats[origin].materialTypes.add(material.materialType);
      }
    });

    const batches = await Batch.findAll({ attributes: ['batchId'] });
    const batchIds = batches.map(b => b.batchId);

    const productionRecords = await ProductionRecord.findAll({
      where: { batchId: { [Op.in]: batchIds } },
      attributes: ['materialsUsed']
    });

    const usedOrigins = new Set<string>();
    productionRecords.forEach(record => {
      if (record.materialsUsed && Array.isArray(record.materialsUsed)) {
        record.materialsUsed.forEach((mat: any) => {
          if (mat.origin) {
            usedOrigins.add(mat.origin);
          }
        });
      }
    });

    Object.keys(originStats).forEach(origin => {
      if (usedOrigins.has(origin)) {
        originStats[origin].usedInBatches = productionRecords.length;
      }
      originStats[origin].materialTypes = Array.from(originStats[origin].materialTypes);
    });

    const originList = Object.values(originStats).sort((a, b) => b.totalMaterials - a.totalMaterials);

    res.json({
      success: true,
      message: '获取原料产地统计成功',
      data: {
        origins: originList,
        totalOrigins: originList.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取原料产地统计失败',
      error: (error as Error).message
    });
  }
};

export const getOriginCraftRelations = async (req: Request, res: Response) => {
  try {
    const { origin } = req.params;

    const materials = await Material.findAll({
      where: { origin: { [Op.like]: `%${origin}%` } }
    });

    if (materials.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该产地的原料'
      });
    }

    const materialIds = materials.map(m => m.materialId);

    const allCrafts = await CraftProcess.findAll();
    const relatedCrafts: any[] = [];

    allCrafts.forEach(craft => {
      if (craft.materials && Array.isArray(craft.materials)) {
        const usesOriginMaterial = craft.materials.some((mat: any) =>
          materialIds.includes(mat.materialId)
        );
        if (usesOriginMaterial) {
          const usedMaterials = craft.materials.filter((mat: any) =>
            materialIds.includes(mat.materialId)
          );
          relatedCrafts.push({
            craft: craft.toJSON(),
            usedMaterials
          });
        }
      }
    });

    const batchesUsingOrigin = await Batch.findAll({
      where: {
        craftId: {
          [Op.in]: relatedCrafts.map(c => c.craft.craftId)
        }
      }
    });

    res.json({
      success: true,
      message: '获取产地工艺关联成功',
      data: {
        origin,
        materials: materials.map(m => m.toJSON()),
        relatedCrafts,
        batchesUsingOrigin: batchesUsingOrigin.map(b => b.toJSON()),
        summary: {
          totalMaterials: materials.length,
          relatedCraftsCount: relatedCrafts.length,
          batchesUsingOriginCount: batchesUsingOrigin.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取产地工艺关联失败',
      error: (error as Error).message
    });
  }
};

export const getCraftOriginUsage = async (req: Request, res: Response) => {
  try {
    const { craftId } = req.params;

    const craft = await CraftProcess.findOne({ where: { craftId } });
    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在'
      });
    }

    const craftMaterials = craft.materials || [];
    const materialIds = craftMaterials.map((m: any) => m.materialId);

    const materialsWithOrigin = await Material.findAll({
      where: { materialId: { [Op.in]: materialIds } }
    });

    const originDistribution: Record<string, any> = {};

    materialsWithOrigin.forEach(material => {
      const origin = material.origin || '未知';
      if (!originDistribution[origin]) {
        originDistribution[origin] = {
          origin,
          materials: [],
          totalQuantity: 0,
          suppliers: new Set()
        };
      }
      originDistribution[origin].materials.push(material.toJSON());
      originDistribution[origin].totalQuantity += Number(material.quantity) || 0;
      if (material.supplierName) {
        originDistribution[origin].suppliers.add(material.supplierName);
      }
    });

    Object.keys(originDistribution).forEach(origin => {
      originDistribution[origin].suppliers = Array.from(originDistribution[origin].suppliers);
    });

    const batches = await Batch.findAll({ where: { craftId } });

    res.json({
      success: true,
      message: '获取工艺原料产地分布成功',
      data: {
        craft: craft.toJSON(),
        originDistribution: Object.values(originDistribution),
        batches: batches.map(b => b.toJSON()),
        summary: {
          totalMaterials: materialsWithOrigin.length,
          originsCount: Object.keys(originDistribution).length,
          batchesCount: batches.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工艺原料产地分布失败',
      error: (error as Error).message
    });
  }
};

export const getOriginHeatmap = async (req: Request, res: Response) => {
  try {
    const materials = await Material.findAll({
      attributes: ['origin', 'materialType', 'quantity', 'qualityLevel', 'status']
    });

    const heatmapData: Record<string, any> = {};

    materials.forEach(material => {
      const origin = material.origin || '未知';
      if (!heatmapData[origin]) {
        heatmapData[origin] = {
          origin,
          totalQuantity: 0,
          materialCount: 0,
          qualityDistribution: {
            premium: 0,
            standard: 0,
            basic: 0,
            unknown: 0
          },
          statusDistribution: {
            in_stock: 0,
            used: 0,
            expired: 0
          },
          materialTypes: new Set()
        };
      }

      heatmapData[origin].totalQuantity += Number(material.quantity) || 0;
      heatmapData[origin].materialCount++;

      const ql = (material.qualityLevel || 'unknown').toLowerCase();
      if (ql.includes('premium') || ql.includes('优质')) {
        heatmapData[origin].qualityDistribution.premium++;
      } else if (ql.includes('standard') || ql.includes('标准')) {
        heatmapData[origin].qualityDistribution.standard++;
      } else if (ql.includes('basic') || ql.includes('基础')) {
        heatmapData[origin].qualityDistribution.basic++;
      } else {
        heatmapData[origin].qualityDistribution.unknown++;
      }

      if (material.status && heatmapData[origin].statusDistribution[material.status] !== undefined) {
        heatmapData[origin].statusDistribution[material.status]++;
      }

      if (material.materialType) {
        heatmapData[origin].materialTypes.add(material.materialType);
      }
    });

    const heatmapList = Object.values(heatmapData).map(item => ({
      ...item,
      materialTypes: Array.from(item.materialTypes),
      intensity: Math.min(100, Math.round((item.materialCount / Math.max(1, materials.length)) * 100))
    })).sort((a, b) => b.materialCount - a.materialCount);

    res.json({
      success: true,
      message: '获取原料产地热度图成功',
      data: {
        heatmap: heatmapList,
        summary: {
          totalOrigins: heatmapList.length,
          totalMaterials: materials.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取原料产地热度图失败',
      error: (error as Error).message
    });
  }
};

export const getOriginCraftMatrix = async (req: Request, res: Response) => {
  try {
    const crafts = await CraftProcess.findAll();
    const materials = await Material.findAll();

    const origins = [...new Set(materials.map(m => m.origin || '未知'))];
    const craftTypes = [...new Set(crafts.map(c => c.craftType || '未分类'))];

    const matrix: Record<string, Record<string, number>> = {};

    craftTypes.forEach(craftType => {
      matrix[craftType] = {};
      origins.forEach(origin => {
        matrix[craftType][origin] = 0;
      });
    });

    crafts.forEach(craft => {
      if (craft.materials && Array.isArray(craft.materials)) {
        const craftMaterialIds = craft.materials.map((m: any) => m.materialId);
        const craftOriginMaterials = materials.filter(m =>
          craftMaterialIds.includes(m.materialId)
        );
        const craftOrigins = [...new Set(craftOriginMaterials.map(m => m.origin || '未知'))];

        const cType = craft.craftType || '未分类';
        craftOrigins.forEach(origin => {
          if (matrix[cType][origin] !== undefined) {
            matrix[cType][origin]++;
          }
        });
      }
    });

    res.json({
      success: true,
      message: '获取产地工艺矩阵成功',
      data: {
        origins,
        craftTypes,
        matrix
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取产地工艺矩阵失败',
      error: (error as Error).message
    });
  }
};

export const searchByOriginOrCraft = async (req: Request, res: Response) => {
  try {
    const { keyword, type = 'all' } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词'
      });
    }

    const results: any = {
      materials: [],
      crafts: [],
      batches: []
    };

    if (type === 'all' || type === 'material') {
      results.materials = await Material.findAll({
        where: {
          [Op.or]: [
            { origin: { [Op.like]: `%${keyword}%` } },
            { materialName: { [Op.like]: `%${keyword}%` } },
            { materialType: { [Op.like]: `%${keyword}%` } }
          ]
        },
        limit: 20
      });
    }

    if (type === 'all' || type === 'craft') {
      results.crafts = await CraftProcess.findAll({
        where: {
          [Op.or]: [
            { craftName: { [Op.like]: `%${keyword}%` } },
            { craftType: { [Op.like]: `%${keyword}%` } },
            { artisanName: { [Op.like]: `%${keyword}%` } }
          ]
        },
        limit: 20
      });
    }

    if (type === 'all' || type === 'batch') {
      results.batches = await Batch.findAll({
        where: {
          [Op.or]: [
            { batchName: { [Op.like]: `%${keyword}%` } },
            { workshopName: { [Op.like]: `%${keyword}%` } }
          ]
        },
        limit: 20
      });
    }

    res.json({
      success: true,
      message: '搜索成功',
      data: {
        keyword,
        type,
        results,
        totalCount:
          results.materials.length +
          results.crafts.length +
          results.batches.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: (error as Error).message
    });
  }
};
