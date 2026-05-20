import prisma from '../config/database';
import logger from '../utils/logger';

export class CategoryService {
  async getAllCategories() {
    return prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { materials: true },
    });

    if (!category) {
      throw new Error('分类不存在');
    }

    return category;
  }

  async createCategory(data: { name: string; description?: string; ethnicity?: string }) {
    const existing = await prisma.category.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error('分类名称已存在');
    }

    const category = await prisma.category.create({ data });
    logger.info(`Category created: ${category.name}`);
    return category;
  }

  async updateCategory(id: string, data: { name?: string; description?: string; ethnicity?: string }) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new Error('分类不存在');
    }

    const updated = await prisma.category.update({ where: { id }, data });
    logger.info(`Category updated: ${updated.name}`);
    return updated;
  }

  async deleteCategory(id: string) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new Error('分类不存在');
    }

    const materialCount = await prisma.patternMaterial.count({
      where: { categoryId: id },
    });

    if (materialCount > 0) {
      throw new Error('该分类下还有素材，无法删除');
    }

    await prisma.category.delete({ where: { id } });
    logger.info(`Category deleted: ${name}`);
  }
}
