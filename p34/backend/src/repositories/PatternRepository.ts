import { GeneratedPattern, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

export class PatternRepository extends BaseRepository<
  GeneratedPattern,
  Prisma.GeneratedPatternCreateInput,
  Prisma.GeneratedPatternUpdateInput
> {
  constructor() {
    super('generatedPattern');
  }

  async findByUser(userId: string, page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { createdBy: userId },
      include: { creator: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublic(page: number, pageSize: number) {
    return this.findPaginated(page, pageSize, {
      where: { isPublic: true },
      include: { creator: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
