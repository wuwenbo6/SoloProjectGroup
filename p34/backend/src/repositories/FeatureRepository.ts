import { PatternFeature, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

export class FeatureRepository extends BaseRepository<
  PatternFeature,
  Prisma.PatternFeatureCreateInput,
  Prisma.PatternFeatureUpdateInput
> {
  constructor() {
    super('patternFeature');
  }

  async findByMaterial(materialId: string): Promise<PatternFeature | null> {
    return this.prisma.patternFeature.findUnique({
      where: { materialId },
      include: {
        material: true,
        extractor: { select: { id: true, username: true } },
      },
    });
  }

  async findByUser(userId: string, page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { extractedBy: userId },
      include: {
        material: true,
        extractor: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
