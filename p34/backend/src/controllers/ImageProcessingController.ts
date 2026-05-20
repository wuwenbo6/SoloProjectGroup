import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ImageProcessingService, ColorAdjustParams, StyleFilterParams } from '../services/ImageProcessingService';
import { ExportService, ExportOptions } from '../services/ExportService';
import { SimilarityService } from '../services/SimilarityService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class ImageProcessingController {
  private imageProcessing: ImageProcessingService;
  private exportService: ExportService;
  private similarityService: SimilarityService;

  constructor() {
    this.imageProcessing = new ImageProcessingService();
    this.exportService = new ExportService();
    this.similarityService = new SimilarityService();
  }

  async adjustColor(req: Request, res: Response) {
    try {
      const { materialId, hue, saturation, brightness, contrast } = req.body;
      
      const material = await (require('../config/database').default).patternMaterial.findUnique({
        where: { id: materialId },
      });

      if (!material) {
        return errorResponse(res, '素材不存在', 404);
      }

      const params: ColorAdjustParams = { hue, saturation, brightness, contrast };
      const outputPath = await this.imageProcessing.adjustColor(material.imageUrl, params);

      return successResponse(res, {
        imageUrl: outputPath,
        params,
      }, '色彩调整完成');
    } catch (error) {
      logger.error('Color adjustment failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '色彩调整失败');
    }
  }

  async applyStyleFilter(req: Request, res: Response) {
    try {
      const { materialId, filterType, intensity } = req.body;
      
      const material = await (require('../config/database').default).patternMaterial.findUnique({
        where: { id: materialId },
      });

      if (!material) {
        return errorResponse(res, '素材不存在', 404);
      }

      const params: StyleFilterParams = { filterType, intensity };
      const outputPath = await this.imageProcessing.applyStyleFilter(material.imageUrl, params);

      return successResponse(res, {
        imageUrl: outputPath,
        params,
      }, '风格转换完成');
    } catch (error) {
      logger.error('Style filter application failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '风格转换失败');
    }
  }

  async exportPattern(req: Request, res: Response) {
    try {
      const { patternId } = req.params;
      const options: ExportOptions = req.body;

      const outputPath = await this.exportService.exportPattern(patternId, options);
      const fileName = path.basename(outputPath);

      res.download(outputPath, fileName, (err) => {
        if (err) {
          logger.error('Download failed:', err);
        }
      });
    } catch (error) {
      logger.error('Pattern export failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '图案导出失败');
    }
  }

  async batchExport(req: Request, res: Response) {
    try {
      const { patternIds, options } = req.body;

      if (!patternIds || !Array.isArray(patternIds) || patternIds.length === 0) {
        return errorResponse(res, '请选择要导出的图案', 400);
      }

      const zipPath = await this.exportService.batchExport(patternIds, options);
      const fileName = path.basename(zipPath);

      res.download(zipPath, fileName, (err) => {
        if (err) {
          logger.error('Batch download failed:', err);
        }
      });
    } catch (error) {
      logger.error('Batch export failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '批量导出失败');
    }
  }

  async searchByImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        return errorResponse(res, '请上传搜索图片', 400);
      }

      const { limit, threshold, categoryId, ethnicity } = req.body;

      const results = await this.similarityService.searchByImage(req.file.path, {
        limit: limit ? parseInt(limit) : undefined,
        threshold: threshold ? parseFloat(threshold) : undefined,
        categoryId,
        ethnicity,
      });

      fs.unlink(req.file.path, (err) => {
        if (err) logger.warn('Failed to clean up upload:', err);
      });

      return successResponse(res, { results, count: results.length }, '相似度检索完成');
    } catch (error) {
      logger.error('Image search failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '图像检索失败');
    }
  }

  async searchByMaterial(req: Request, res: Response) {
    try {
      const { materialId } = req.params;
      const { limit, threshold, categoryId, ethnicity } = req.query;

      const results = await this.similarityService.searchByMaterial(materialId, {
        limit: limit ? parseInt(limit as string) : undefined,
        threshold: threshold ? parseFloat(threshold as string) : undefined,
        categoryId: categoryId as string,
        ethnicity: ethnicity as string,
      });

      return successResponse(res, { results, count: results.length }, '相似度检索完成');
    } catch (error) {
      logger.error('Material search failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '素材检索失败');
    }
  }

  async getRelatedMaterials(req: Request, res: Response) {
    try {
      const { materialId } = req.params;
      const { limit } = req.query;

      const results = await this.similarityService.getRelatedMaterials(
        materialId,
        limit ? parseInt(limit as string) : undefined
      );

      return successResponse(res, { results }, '相关素材检索完成');
    } catch (error) {
      logger.error('Related materials search failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '检索相关素材失败');
    }
  }

  async rebuildFeatureVectors(req: Request, res: Response) {
    try {
      const result = await this.similarityService.rebuildAllFeatureVectors();
      return successResponse(res, result, '特征向量重建完成');
    } catch (error) {
      logger.error('Feature vector rebuild failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '特征向量重建失败');
    }
  }
}
