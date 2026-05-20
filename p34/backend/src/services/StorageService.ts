import path from 'path';
import fs from 'fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import prisma from '../config/database';
import logger from '../utils/logger';

export type StorageTier = 'HOT' | 'COLD' | 'ARCHIVE';

export interface StorageConfig {
  hotPath: string;
  coldPath: string;
  archivePath: string;
  hotThresholdDays: number;
  coldThresholdDays: number;
  compression: boolean;
}

export interface MaterialStorageInfo {
  materialId: string;
  currentTier: StorageTier;
  originalPath: string;
  currentPath: string;
  fileSize: number;
  lastAccessedAt: Date;
  accessCount: number;
}

const DEFAULT_CONFIG: StorageConfig = {
  hotPath: path.join(process.cwd(), 'uploads', 'hot'),
  coldPath: path.join(process.cwd(), 'uploads', 'cold'),
  archivePath: path.join(process.cwd(), 'uploads', 'archive'),
  hotThresholdDays: 30,
  coldThresholdDays: 90,
  compression: true,
};

export class StorageService {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeStorageDirectories();
  }

  private async initializeStorageDirectories() {
    try {
      await Promise.all([
        fs.mkdir(this.config.hotPath, { recursive: true }),
        fs.mkdir(this.config.coldPath, { recursive: true }),
        fs.mkdir(this.config.archivePath, { recursive: true }),
      ]);
      logger.info('Storage directories initialized');
    } catch (error) {
      logger.error('Failed to initialize storage directories:', error);
    }
  }

  async storeMaterial(
    file: Express.Multer.File,
    materialId: string,
    userId: string
  ): Promise<{ path: string; tier: StorageTier }> {
    const ext = path.extname(file.originalname);
    const filename = `${materialId}${ext}`;
    const hotPath = path.join(this.config.hotPath, filename);

    await fs.writeFile(hotPath, file.buffer);

    await prisma.materialStorage.create({
      data: {
        materialId,
        currentTier: 'HOT',
        originalPath: hotPath,
        currentPath: hotPath,
        fileSize: file.size,
        lastAccessedAt: new Date(),
        accessCount: 1,
      },
    });

    logger.info(`Material ${materialId} stored in HOT tier`);
    return { path: hotPath, tier: 'HOT' };
  }

  async getMaterialPath(materialId: string): Promise<string | null> {
    const storage = await prisma.materialStorage.findUnique({
      where: { materialId },
    });

    if (!storage) return null;

    await prisma.materialStorage.update({
      where: { materialId },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    if (storage.currentTier === 'COLD' || storage.currentTier === 'ARCHIVE') {
      return await this.promoteToHot(materialId);
    }

    return storage.currentPath;
  }

  private async promoteToHot(materialId: string): Promise<string> {
    const storage = await prisma.materialStorage.findUniqueOrThrow({
      where: { materialId },
    });

    const filename = path.basename(storage.currentPath);
    const hotPath = path.join(this.config.hotPath, filename);

    if (!existsSync(hotPath)) {
      await this.copyFile(storage.currentPath, hotPath);
    }

    await prisma.materialStorage.update({
      where: { materialId },
      data: {
        currentTier: 'HOT',
        currentPath: hotPath,
        lastAccessedAt: new Date(),
      },
    });

    logger.info(`Material ${materialId} promoted to HOT tier`);
    return hotPath;
  }

  private async demoteToCold(materialId: string): Promise<void> {
    const storage = await prisma.materialStorage.findUniqueOrThrow({
      where: { materialId },
    });

    if (storage.currentTier === 'COLD') return;

    const filename = path.basename(storage.currentPath);
    const coldPath = path.join(this.config.coldPath, filename);

    if (!existsSync(coldPath)) {
      await this.copyFile(storage.currentPath, coldPath);
    }

    if (storage.currentTier === 'HOT') {
      await fs.unlink(storage.currentPath).catch(() => {});
    }

    await prisma.materialStorage.update({
      where: { materialId },
      data: {
        currentTier: 'COLD',
        currentPath: coldPath,
      },
    });

    logger.info(`Material ${materialId} demoted to COLD tier`);
  }

  private async archiveMaterial(materialId: string): Promise<void> {
    const storage = await prisma.materialStorage.findUniqueOrThrow({
      where: { materialId },
    });

    if (storage.currentTier === 'ARCHIVE') return;

    const filename = path.basename(storage.currentPath);
    const archivePath = path.join(this.config.archivePath, filename);

    if (!existsSync(archivePath)) {
      await this.copyFile(storage.currentPath, archivePath);
    }

    if (storage.currentTier === 'HOT' || storage.currentTier === 'COLD') {
      await fs.unlink(storage.currentPath).catch(() => {});
    }

    await prisma.materialStorage.update({
      where: { materialId },
      data: {
        currentTier: 'ARCHIVE',
        currentPath: archivePath,
      },
    });

    logger.info(`Material ${materialId} archived`);
  }

  private async copyFile(source: string, destination: string): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await pipeline(createReadStream(source), createWriteStream(destination));
  }

  async runStorageLifecycle(): Promise<{
    demotedToCold: number;
    archived: number;
    errors: number;
  }> {
    const now = new Date();
    const hotThreshold = new Date(now.getTime() - this.config.hotThresholdDays * 24 * 60 * 60 * 1000);
    const coldThreshold = new Date(now.getTime() - this.config.coldThresholdDays * 24 * 60 * 60 * 1000);

    let demotedToCold = 0;
    let archived = 0;
    let errors = 0;

    const hotMaterials = await prisma.materialStorage.findMany({
      where: {
        currentTier: 'HOT',
        lastAccessedAt: { lt: hotThreshold },
      },
    });

    for (const material of hotMaterials) {
      try {
        await this.demoteToCold(material.materialId);
        demotedToCold++;
      } catch (error) {
        logger.error(`Failed to demote material ${material.materialId}:`, error);
        errors++;
      }
    }

    const coldMaterials = await prisma.materialStorage.findMany({
      where: {
        currentTier: 'COLD',
        lastAccessedAt: { lt: coldThreshold },
      },
    });

    for (const material of coldMaterials) {
      try {
        await this.archiveMaterial(material.materialId);
        archived++;
      } catch (error) {
        logger.error(`Failed to archive material ${material.materialId}:`, error);
        errors++;
      }
    }

    logger.info(`Storage lifecycle completed: ${demotedToCold} demoted, ${archived} archived, ${errors} errors`);
    return { demotedToCold, archived, errors };
  }

  async getStorageStats(): Promise<{
    totalMaterials: number;
    byTier: { tier: StorageTier; count: number; totalSize: number }[];
    totalSize: number;
  }> {
    const storages = await prisma.materialStorage.findMany({
      select: { currentTier: true, fileSize: true },
    });

    const byTier = new Map<StorageTier, { count: number; totalSize: number }>();
    byTier.set('HOT', { count: 0, totalSize: 0 });
    byTier.set('COLD', { count: 0, totalSize: 0 });
    byTier.set('ARCHIVE', { count: 0, totalSize: 0 });

    let totalSize = 0;

    for (const storage of storages) {
      const tier = storage.currentTier as StorageTier;
      const data = byTier.get(tier)!;
      data.count++;
      data.totalSize += storage.fileSize;
      totalSize += storage.fileSize;
    }

    return {
      totalMaterials: storages.length,
      byTier: Array.from(byTier.entries()).map(([tier, { count, totalSize }]) => ({
        tier,
        count,
        totalSize,
      })),
      totalSize,
    };
  }

  async deleteMaterial(materialId: string): Promise<void> {
    const storage = await prisma.materialStorage.findUnique({
      where: { materialId },
    });

    if (!storage) return;

    const paths = [
      path.join(this.config.hotPath, path.basename(storage.originalPath)),
      path.join(this.config.coldPath, path.basename(storage.originalPath)),
      path.join(this.config.archivePath, path.basename(storage.originalPath)),
    ];

    for (const p of paths) {
      await fs.unlink(p).catch(() => {});
    }

    await prisma.materialStorage.delete({
      where: { materialId },
    });

    logger.info(`Material ${materialId} deleted from all tiers`);
  }

  async getMaterialStorageInfo(materialId: string): Promise<MaterialStorageInfo | null> {
    const storage = await prisma.materialStorage.findUnique({
      where: { materialId },
    });

    if (!storage) return null;

    return {
      materialId: storage.materialId,
      currentTier: storage.currentTier as StorageTier,
      originalPath: storage.originalPath,
      currentPath: storage.currentPath,
      fileSize: storage.fileSize,
      lastAccessedAt: storage.lastAccessedAt,
      accessCount: storage.accessCount,
    };
  }

  async manualPromote(materialId: string, targetTier: StorageTier): Promise<void> {
    const storage = await prisma.materialStorage.findUniqueOrThrow({
      where: { materialId },
    });

    if (storage.currentTier === targetTier) return;

    if (targetTier === 'HOT') {
      await this.promoteToHot(materialId);
    } else if (targetTier === 'COLD') {
      await this.demoteToCold(materialId);
    } else if (targetTier === 'ARCHIVE') {
      await this.archiveMaterial(materialId);
    }
  }
}
