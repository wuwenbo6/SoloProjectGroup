import { PatternMaterial, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

export class MaterialRepository extends BaseRepository<
  PatternMaterial,
  Prisma.PatternMaterialCreateInput,
  Prisma.PatternMaterialUpdateInput
> {
  constructor() {
    super('patternMaterial');
  }

  async findByUser(userId: string, page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { uploadedBy: userId },
      include: { category: true, uploader: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCategory(categoryId: string, page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { categoryId },
      include: { category: true, uploader: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEthnicity(ethnicity: string, page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { ethnicity },
      include: { category: true, uploader: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithDetails(id: string) {
    return this.prisma.patternMaterial.findUnique({
      where: { id },
      include: {
        category: true,
        uploader: { select: { id: true, username: true } },
        feature: true,
      },
    });
  }
}
