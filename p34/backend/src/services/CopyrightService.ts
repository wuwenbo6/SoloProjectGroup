import prisma from '../config/database';
import logger from '../utils/logger';
import { createHash } from 'crypto';

export interface CopyrightRegistrationData {
  patternId?: string;
  materialId?: string;
  title: string;
  author: string;
  creationDate?: Date;
  copyrightType: string;
  scope?: string;
  remarks?: string;
}

export class CopyrightService {
  async createRegistration(data: CopyrightRegistrationData, creatorId: string) {
    const registration = await prisma.copyrightRegistration.create({
      data: {
        patternId: data.patternId,
        materialId: data.materialId,
        title: data.title,
        author: data.author,
        creationDate: data.creationDate,
        copyrightType: data.copyrightType,
        scope: data.scope,
        remarks: data.remarks,
        status: 'PENDING',
        createdBy: creatorId,
      },
    });

    await this.logAction(registration.id, 'CREATE', creatorId, '创建版权登记申请');

    logger.info(`Copyright registration created: ${registration.id}`);
    return registration;
  }

  async getRegistrations(filters: any = {}, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.copyrightType) where.copyrightType = filters.copyrightType;
    if (filters.createdBy) where.createdBy = filters.createdBy;

    const [registrations, total] = await Promise.all([
      prisma.copyrightRegistration.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          pattern: { select: { id: true, imageUrl: true } },
          material: { select: { id: true, imageUrl: true, thumbnailUrl: true } },
          creator: { select: { id: true, username: true } },
          reviewer: { select: { id: true, username: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.copyrightRegistration.count({ where }),
    ]);

    return { data: registrations, total, page, pageSize };
  }

  async getRegistrationById(id: string) {
    return prisma.copyrightRegistration.findUnique({
      where: { id },
      include: {
        pattern: true,
        material: true,
        creator: { select: { id: true, username: true, email: true } },
        reviewer: { select: { id: true, username: true, email: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { id: true, username: true } } },
        },
      },
    });
  }

  async updateRegistration(id: string, data: Partial<CopyrightRegistrationData>, operatorId: string) {
    const registration = await prisma.copyrightRegistration.update({
      where: { id },
      data: {
        title: data.title,
        author: data.author,
        creationDate: data.creationDate,
        copyrightType: data.copyrightType,
        scope: data.scope,
        remarks: data.remarks,
      },
    });

    await this.logAction(id, 'UPDATE', operatorId, '更新版权登记信息');

    logger.info(`Copyright registration updated: ${id}`);
    return registration;
  }

  async submitForReview(id: string, operatorId: string) {
    const registration = await prisma.copyrightRegistration.update({
      where: { id },
      data: { status: 'PENDING' },
    });

    await this.logAction(id, 'SUBMIT', operatorId, '提交版权审核');

    logger.info(`Copyright registration submitted for review: ${id}`);
    return registration;
  }

  async reviewRegistration(
    id: string,
    reviewerId: string,
    result: 'REGISTERED' | 'REJECTED',
    remarks?: string
  ) {
    const registration = await prisma.copyrightRegistration.update({
      where: { id },
      data: {
        status: result,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (result === 'REGISTERED') {
      const registrationNo = await this.generateRegistrationNo(id);
      await prisma.copyrightRegistration.update({
        where: { id },
        data: {
          registrationNo,
          registrationDate: new Date(),
          evidenceHash: await this.generateEvidenceHash(id),
        },
      });
    }

    await this.logAction(
      id,
      result === 'REGISTERED' ? 'APPROVE' : 'REJECT',
      reviewerId,
      remarks || (result === 'REGISTERED' ? '审核通过，版权登记完成' : '审核未通过')
    );

    logger.info(`Copyright registration ${result}: ${id}`);
    return registration;
  }

  private async generateRegistrationNo(id: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.copyrightRegistration.count({
      where: {
        createdAt: {
          gte: new Date(year, 0, 1),
        },
      },
    });
    return `CR${year}${String(count + 1).padStart(6, '0')}`;
  }

  private async generateEvidenceHash(id: string): Promise<string> {
    const registration = await this.getRegistrationById(id);
    if (!registration) throw new Error('登记记录不存在');

    const content = `${registration.title}|${registration.author}|${registration.createdAt}|${registration.copyrightType}`;
    return createHash('sha256').update(content).digest('hex');
  }

  async registerBlockchain(id: string, txId: string, operatorId: string) {
    const registration = await prisma.copyrightRegistration.update({
      where: { id },
      data: { blockchainTxId: txId },
    });

    await this.logAction(id, 'BLOCKCHAIN', operatorId, `区块链存证完成: ${txId}`);

    logger.info(`Blockchain registration completed: ${id}`);
    return registration;
  }

  async uploadCertificate(id: string, certificateUrl: string, operatorId: string) {
    const registration = await prisma.copyrightRegistration.update({
      where: { id },
      data: { certificateUrl },
    });

    await this.logAction(id, 'CERTIFICATE', operatorId, '上传版权证书');

    logger.info(`Certificate uploaded for registration: ${id}`);
    return registration;
  }

  async deleteRegistration(id: string, operatorId: string) {
    await prisma.copyrightRegistration.delete({ where: { id } });

    await this.logAction(id, 'DELETE', operatorId, '删除版权登记记录');

    logger.info(`Copyright registration deleted: ${id}`);
  }

  private async logAction(registrationId: string, action: string, operatorId: string, remarks?: string) {
    await prisma.copyrightLog.create({
      data: {
        registrationId,
        action,
        remarks,
        operatorId,
      },
    });
  }

  async getStatistics() {
    const [total, byStatus, byType] = await Promise.all([
      prisma.copyrightRegistration.count(),
      prisma.copyrightRegistration.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.copyrightRegistration.groupBy({
        by: ['copyrightType'],
        _count: true,
      }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await prisma.copyrightRegistration.count({
      where: { createdAt: { gte: thisMonth } },
    });

    return {
      total,
      monthlyCount,
      byStatus,
      byType,
    };
  }

  async getMyRegistrations(userId: string, page: number = 1, pageSize: number = 20) {
    return this.getRegistrations({ createdBy: userId }, page, pageSize);
  }

  async getRegistrationLogs(id: string) {
    return prisma.copyrightLog.findMany({
      where: { registrationId: id },
      orderBy: { createdAt: 'desc' },
      include: { operator: { select: { id: true, username: true } } },
    });
  }
}
