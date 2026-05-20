import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { MaterialRepository } from '../repositories/MaterialRepository';
import prisma from '../config/database';
import logger from '../utils/logger';
import { UploadMaterialRequest } from '../types';

export class MaterialService {
  private materialRepository: MaterialRepository;

  constructor() {
    this.materialRepository = new MaterialRepository();
  }

  async uploadMaterial(
    userId: string,
    file: Express.Multer.File,
    request: UploadMaterialRequest
  ) {
    const thumbnailPath = path.join(config.uploads.path, 'materials', `thumb_${uuidv4()}.webp`);
    
    await sharp(file.path)
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    const material = await this.materialRepository.create({
      name: request.name,
      description: request.description,
      categoryId: request.categoryId,
      ethnicity: request.ethnicity,
      imageUrl: file.path,
      thumbnailUrl: thumbnailPath,
      status: 'PENDING',
      uploader: { connect: { id: userId } },
    });

    logger.info(`Material uploaded: ${material.id} by user: ${userId}`);
    return material;
  }

  async getMaterials(page: number, pageSize: number, filters?: { categoryId?: string; ethnicity?: string; status?: string }) {
    const where: any = {};
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.ethnicity) where.ethnicity = filters.ethnicity;
    if (filters?.status) where.status = filters.status;

    return this.materialRepository.findPaginated(page, pageSize, {
      where,
      include: { category: true, uploader: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMaterialById(id: string) {
    const material = await this.materialRepository.findWithDetails(id);
    if (!material) {
      throw new Error('素材不存在');
    }
    return material;
  }

  async getMaterialsByUser(userId: string, page: number, pageSize: number) {
    return this.materialRepository.findByUser(userId, page, pageSize);
  }

  async updateMaterial(id: string, userId: string, data: { name?: string; description?: string; categoryId?: string; ethnicity?: string }) {
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new Error('素材不存在');
    }

    if (material.uploadedBy !== userId) {
      throw new Error('无权限修改此素材');
    }

    const updated = await this.materialRepository.update(id, data);
    logger.info(`Material updated: ${id} by user: ${userId}`);
    return updated;
  }

  async deleteMaterial(id: string, userId: string) {
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new Error('素材不存在');
    }

    if (material.uploadedBy !== userId) {
      throw new Error('无权限删除此素材');
    }

    await this.materialRepository.delete(id);
    logger.info(`Material deleted: ${id} by user: ${userId}`);
  }

  async updateMaterialStatus(id: string, status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'ERROR', errorMessage?: string) {
    return this.materialRepository.update(id, { status, errorMessage });
  }

  async getStats() {
    const [total, processed, pending] = await Promise.all([
      this.materialRepository.count(),
      this.materialRepository.count({ where: { status: 'PROCESSED' } }),
      this.materialRepository.count({ where: { status: 'PENDING' } }),
    ]);

    return { total, processed, pending };
  }
}
