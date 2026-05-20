import { PrismaClient } from '@prisma/client';
import prisma from '../config/database';

export class BaseRepository<T, CreateInput, UpdateInput> {
  protected prisma: PrismaClient;
  protected modelName: keyof PrismaClient;

  constructor(modelName: keyof PrismaClient) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  async findById(id: string): Promise<T | null> {
    const model = this.prisma[this.modelName] as any;
    return model.findUnique({ where: { id } });
  }

  async findAll(options: any = {}): Promise<T[]> {
    const model = this.prisma[this.modelName] as any;
    return model.findMany(options);
  }

  async findPaginated(page: number, pageSize: number, options: any = {}): Promise<{ data: T[]; total: number }> {
    const model = this.prisma[this.modelName] as any;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      model.findMany({ ...options, skip, take: pageSize }),
      model.count({ where: options.where }),
    ]);

    return { data, total };
  }

  async create(data: CreateInput): Promise<T> {
    const model = this.prisma[this.modelName] as any;
    return model.create({ data });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    const model = this.prisma[this.modelName] as any;
    return model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    const model = this.prisma[this.modelName] as any;
    return model.delete({ where: { id } });
  }

  async count(options: any = {}): Promise<number> {
    const model = this.prisma[this.modelName] as any;
    return model.count(options);
  }
}
