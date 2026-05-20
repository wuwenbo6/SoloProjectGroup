import prisma from '../config/database';
import logger from '../utils/logger';
import { OperationType } from '@prisma/client';

export class OperationService {
  async logOperation(
    userId: string,
    operationType: OperationType,
    targetType: string,
    targetId: string,
    details?: Record<string, any>
  ) {
    const operation = await prisma.userOperation.create({
      data: {
        userId,
        operationType,
        targetType,
        targetId,
        details: details ? JSON.stringify(details) : undefined,
      },
    });

    return operation;
  }

  async getRecentOperations(limit: number = 10) {
    return prisma.userOperation.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async getUserOperations(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.userOperation.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userOperation.count({ where: { userId } }),
    ]);

    return { data, total };
  }
}
