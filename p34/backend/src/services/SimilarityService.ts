import { ImageProcessingService } from './ImageProcessingService';
import prisma from '../config/database';
import logger from '../utils/logger';

interface SimilarityResult {
  id: string;
  name: string;
  thumbnailUrl: string;
  similarity: number;
  ethnicity?: string;
  categoryId?: string;
}

interface SearchOptions {
  limit?: number;
  threshold?: number;
  categoryId?: string;
  ethnicity?: string;
}

export class SimilarityService {
  private imageProcessing: ImageProcessingService;

  constructor() {
    this.imageProcessing = new ImageProcessingService();
  }

  async extractAndStoreFeatures(materialId: string): Promise<void> {
    const material = await prisma.patternMaterial.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      throw new Error('素材不存在');
    }

    try {
      const featureVector = await this.imageProcessing.extractFeatureVector(material.imageUrl);

      await prisma.patternMaterial.update({
        where: { id: materialId },
        data: {
          featureVector: featureVector,
        },
      });

      logger.info(`Features extracted and stored for material: ${materialId}`);
    } catch (error) {
      logger.error('Feature extraction failed:', error);
      throw new Error('特征提取失败');
    }
  }

  async searchByImage(imagePath: string, options: SearchOptions = {}): Promise<SimilarityResult[]> {
    const { limit = 10, threshold = 0.5, categoryId, ethnicity } = options;

    const queryVector = await this.imageProcessing.extractFeatureVector(imagePath);

    const materials = await prisma.patternMaterial.findMany({
      where: {
        status: 'PROCESSED',
        ...(categoryId && { categoryId }),
        ...(ethnicity && { ethnicity }),
      },
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
        ethnicity: true,
        categoryId: true,
        featureVector: true,
      },
    });

    const results: SimilarityResult[] = [];

    for (const material of materials) {
      if (!material.featureVector || !Array.isArray(material.featureVector)) continue;

      try {
        const similarity = this.imageProcessing.calculateSimilarity(
          queryVector,
          material.featureVector as number[]
        );

        if (similarity >= threshold) {
          results.push({
            id: material.id,
            name: material.name,
            thumbnailUrl: material.thumbnailUrl,
            ethnicity: material.ethnicity || undefined,
            categoryId: material.categoryId || undefined,
            similarity,
          });
        }
      } catch (error) {
        logger.warn(`Failed to calculate similarity for material ${material.id}:`, error);
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  async searchByMaterial(materialId: string, options: SearchOptions = {}): Promise<SimilarityResult[]> {
    const material = await prisma.patternMaterial.findUnique({
      where: { id: materialId },
      select: { featureVector: true },
    });

    if (!material) {
      throw new Error('素材不存在');
    }

    if (!material.featureVector || !Array.isArray(material.featureVector)) {
      await this.extractAndStoreFeatures(materialId);
      return this.searchByMaterial(materialId, options);
    }

    const { limit = 10, threshold = 0.5, categoryId, ethnicity } = options;

    const materials = await prisma.patternMaterial.findMany({
      where: {
        id: { not: materialId },
        status: 'PROCESSED',
        ...(categoryId && { categoryId }),
        ...(ethnicity && { ethnicity }),
      },
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
        ethnicity: true,
        categoryId: true,
        featureVector: true,
      },
    });

    const results: SimilarityResult[] = [];

    for (const m of materials) {
      if (!m.featureVector || !Array.isArray(m.featureVector)) continue;

      try {
        const similarity = this.imageProcessing.calculateSimilarity(
          material.featureVector as number[],
          m.featureVector as number[]
        );

        if (similarity >= threshold) {
          results.push({
            id: m.id,
            name: m.name,
            thumbnailUrl: m.thumbnailUrl,
            ethnicity: m.ethnicity || undefined,
            categoryId: m.categoryId || undefined,
            similarity,
          });
        }
      } catch (error) {
        logger.warn(`Failed to calculate similarity for material ${m.id}:`, error);
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  async searchByPattern(patternId: string, options: SearchOptions = {}): Promise<SimilarityResult[]> {
    const pattern = await prisma.generatedPattern.findUnique({
      where: { id: patternId },
      select: { imageUrl: true },
    });

    if (!pattern) {
      throw new Error('图案不存在');
    }

    return this.searchByImage(pattern.imageUrl, options);
  }

  async getRelatedMaterials(materialId: string, limit: number = 5): Promise<SimilarityResult[]> {
    return this.searchByMaterial(materialId, { limit, threshold: 0.3 });
  }

  async rebuildAllFeatureVectors(): Promise<{ processed: number; failed: number }> {
    const materials = await prisma.patternMaterial.findMany({
      where: {
        OR: [
        { featureVector: null },
        { featureVector: { equals: [] } },
      ]},
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;

    for (const material of materials) {
      try {
        await this.extractAndStoreFeatures(material.id);
        processed++;
      } catch (error) {
        failed++;
        logger.error(`Failed to process material ${material.id}:`, error);
      }
    }

    logger.info(`Feature vector rebuild complete: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }
}
